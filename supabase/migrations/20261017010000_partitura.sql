-- =============================================================================
-- H23 · Ensayar en la app — la partitura de un canto y su bucket.
-- docs/PRD.md §21.4 (datos), §21.5 (autorización), §21.9 (el hito).
--
-- QUÉ ENTRA:
--   La música escrita de un canto, como MusicXML, y lo que el conversor saca de
--   ella: 35 pistas (7 cuerdas × 5 sonidos), la partitura dibujada con su
--   sincronía y un manifiesto. La fila vive acá; los archivos, en Storage.
--
-- LO QUE NO VA A LA BASE (§21.4, «cero valores derivados persistidos»):
--   Las pistas, el dibujo, la sincronía y los rangos son DERIVADOS de la fuente.
--   Viven en Storage bajo una carpeta que lleva la HUELLA (SHA-256) de la fuente
--   de la que salieron: `{coro}/{canto}/{huella}/…`. Subir otra fuente es otra
--   carpeta, así que es imposible servir pistas viejas de una partitura nueva.
--   Es una caché direccionada por su origen, nunca un dato editable.
--
-- `cuerdas` SÍ va a la base, y no es un derivado: es la DECISIÓN del director
-- de qué parte del MusicXML es qué cuerda (§21.4). El conversor propone
-- (`proponerCuerdas`, H25); lo guardado es lo confirmado.
--
-- DOS FILAS POR CANTO, POR UN RATO (§21.7): reemplazar una partitura publicada
-- no la saca de circulación. La nueva entra como borrador y el coro sigue
-- ensayando con la publicada hasta que el director publica. Por eso el índice
-- único es sobre (canto_id, estado), no sobre canto_id solo.
-- =============================================================================

create table if not exists public.partitura (
  id           uuid primary key default gen_random_uuid(),
  canto_id     uuid not null,
  coro_id      uuid not null references public.coros(id) on delete cascade,
  estado       text not null default 'borrador'
                 check (estado in ('borrador', 'publicada')),
  origen       text not null check (origen in ('musicxml', 'pdf')),
  huella       text not null check (huella ~ '^[0-9a-f]{64}$'),
  ruta_fuente  text not null,
  -- {nombre de la parte en el MusicXML: cuerda}. Ver `lib/motores/cuerdas.ts`.
  cuerdas      jsonb not null default '{}'::jsonb
                 check (jsonb_typeof(cuerdas) = 'object'),
  -- Nullable: la semilla de H23 la sube un script, no una persona.
  subida_por   uuid references public.perfiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  publicada_at timestamptz,

  -- Publicada ⇔ tiene fecha de publicación. Sin esto, «cuándo se publicó» sería
  -- un dato que puede contradecir al estado.
  constraint partitura_publicada_con_fecha
    check ((estado = 'publicada') = (publicada_at is not null)),

  -- La ruta de la fuente cuelga de la carpeta de SU huella, en SU coro y canto.
  -- Una fila no puede apuntar a los archivos de otra partitura.
  constraint partitura_ruta_de_su_huella
    check (ruta_fuente like coro_id::text || '/' || canto_id::text || '/' || huella || '/fuente.%')
);

comment on table public.partitura is
  'H23. La partitura (MusicXML) de un canto. Una publicada y un borrador como máximo. Los derivados (pistas, dibujo, sincronía) viven en Storage bajo la huella, no acá (PRD §21.4).';
comment on column public.partitura.huella is
  'SHA-256 de la fuente. Es parte de la ruta de todos sus derivados en Storage.';
comment on column public.partitura.cuerdas is
  'Decisión del director: {parte del MusicXML: cuerda}. Lo propone el conversor y lo confirma el director.';

create unique index if not exists partitura_canto_estado_uk
  on public.partitura (canto_id, estado);
create index if not exists partitura_coro_idx on public.partitura (coro_id);

-- La partitura es del mismo coro que su canto. Solo la foránea compuesta, sin la
-- simple sobre `canto_id`: dos relaciones entre las mismas tablas rompen los
-- embeds de PostgREST (PGRST201, la lección de H15 y H17).
create unique index if not exists cantos_id_coro_uk on public.cantos (id, coro_id);

alter table public.partitura
  drop constraint if exists partitura_canto_del_mismo_coro;
alter table public.partitura
  add constraint partitura_canto_del_mismo_coro
  foreign key (canto_id, coro_id) references public.cantos (id, coro_id) on delete cascade;

-- -----------------------------------------------------------------------------
-- RLS — activa en la MISMA migración que crea la tabla. Clase B.
-- -----------------------------------------------------------------------------

alter table public.partitura enable row level security;

-- El coro ve la publicada; el borrador, solo su director (§21.5: «ver una
-- partitura en borrador» es del director).
drop policy if exists partitura_select on public.partitura;
create policy partitura_select on public.partitura
  for select using (
    public.puede_ver_coro(coro_id)
    and (estado = 'publicada' or public.es_director_de(coro_id))
  );

-- Subir, reemplazar y publicar: el director (§21.5). Sin política de borrado:
-- el borrado de la anterior al publicar la nueva lo hace la server action de
-- H25 con la sesión del director, y se agrega con ese hito.
drop policy if exists partitura_insert on public.partitura;
create policy partitura_insert on public.partitura
  for insert with check (public.es_director_de(coro_id));

drop policy if exists partitura_update on public.partitura;
create policy partitura_update on public.partitura
  for update
  using      (public.es_director_de(coro_id))
  with check (public.es_director_de(coro_id));

-- =============================================================================
-- Storage · bucket `partituras` (privado)
-- =============================================================================
-- Ruta: {coro_id}/{canto_id}/{huella}/fuente.musicxml · pistas/{sonido}/{cuerda}.mp3
--       · partitura.json · manifiesto.json
--
-- Las URLs que llegan al navegador son FIRMADAS, de una hora, y las firma el
-- servidor con la sesión del usuario: si esta política no lo deja leer el
-- objeto, la firma falla y la pantalla dice «no tienes acceso» (§21.4).

insert into storage.buckets (id, name, public, file_size_limit)
values ('partituras', 'partituras', false, 20 * 1024 * 1024)
on conflict (id) do update
  set public = false, file_size_limit = excluded.file_size_limit;

-- La regla de lectura de un objeto, en una sola función.
--
-- Por qué una función y no el predicado suelto en la política: la ruta es texto
-- que viene de afuera. Castear `split_part(name, '/', 1)::uuid` en la política
-- revienta con cualquier nombre que no sea un uuid, y un error en una política
-- de `storage.objects` rompe la consulta entera, no solo esa fila. Acá se valida
-- la forma antes de castear y se devuelve `false`.
--
-- Lee el objeto quien ve el coro Y existe una partitura de ese canto con esa
-- huella que esa persona puede ver: publicada, o en borrador si es el director.
-- Un objeto suelto en una carpeta sin fila no lo lee nadie más que el conversor.
create or replace function public.puede_leer_objeto_partitura(p_nombre text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_coro  text := split_part(p_nombre, '/', 1);
  v_canto text := split_part(p_nombre, '/', 2);
  v_huella text := split_part(p_nombre, '/', 3);
  v_uuid  constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if v_coro !~ v_uuid or v_canto !~ v_uuid or v_huella !~ '^[0-9a-f]{64}$' then
    return false;
  end if;

  return public.puede_ver_coro(v_coro::uuid)
     and exists (
       select 1 from public.partitura p
       where p.coro_id  = v_coro::uuid
         and p.canto_id = v_canto::uuid
         and p.huella   = v_huella
         and (p.estado = 'publicada' or public.es_director_de(p.coro_id))
     );
end;
$$;

-- Escribir: el director solo sube la FUENTE de su coro (H25). Pistas, dibujo,
-- sincronía y manifiesto los escribe solo el conversor, con la clave de
-- servicio, que no pasa por RLS (§21.5: «escribir una pista» es «no» para todos).
create or replace function public.puede_subir_fuente_partitura(p_nombre text)
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_coro  text := split_part(p_nombre, '/', 1);
  v_uuid  constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if p_nombre !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f]{64}/fuente\.(musicxml|mxl|pdf|png|jpg)$'
     or v_coro !~ v_uuid then
    return false;
  end if;
  return public.es_director_de(v_coro::uuid);
end;
$$;

grant execute on function public.puede_leer_objeto_partitura(text)  to anon, authenticated, service_role;
grant execute on function public.puede_subir_fuente_partitura(text) to anon, authenticated, service_role;

drop policy if exists partituras_select on storage.objects;
create policy partituras_select on storage.objects
  for select to authenticated
  using (bucket_id = 'partituras' and public.puede_leer_objeto_partitura(name));

drop policy if exists partituras_insert_fuente on storage.objects;
create policy partituras_insert_fuente on storage.objects
  for insert to authenticated
  with check (bucket_id = 'partituras' and public.puede_subir_fuente_partitura(name));
