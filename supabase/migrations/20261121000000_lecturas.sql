-- =============================================================================
-- Lecturas del domingo — 2026-11-20
--
-- Una misa puede tener hasta cuatro partes (primera, salmo, segunda,
-- evangelio). El texto vive en la base del coro: nunca se versiona texto real
-- del leccionario. El importador trae las partes desde la página pública de
-- Iglesia.cl y el director confirma; esta tabla es donde quedan guardadas.
--
-- `coro_id` va denormalizado y la foránea compuesta `(misa_id, coro_id)` contra
-- `misas (id, coro_id)` vuelve imposible colgar una lectura de una misa de otro
-- coro. El `unique (misa_id, tipo)` garantiza una sola fila por parte, que es lo
-- que permite a la RPC reemplazar en bloque sin duplicar.
-- =============================================================================

create table public.misa_lectura (
  id uuid primary key default gen_random_uuid(),
  misa_id uuid not null,
  coro_id uuid not null,
  tipo text not null check (tipo in ('primera','salmo','segunda','evangelio')),
  referencia text not null default '',
  texto text not null default '',
  fuente text not null default 'manual' check (fuente in ('iglesia.cl','manual')),
  fuente_url text,
  traido_en timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (misa_id, tipo),
  unique (id, coro_id),
  foreign key (misa_id, coro_id) references public.misas (id, coro_id) on delete cascade
);

create index if not exists misa_lectura_coro_idx on public.misa_lectura (coro_id);

alter table public.misa_lectura enable row level security;

create policy misa_lectura_select on public.misa_lectura
  for select using (public.puede_ver_coro(coro_id));

create policy misa_lectura_write on public.misa_lectura
  for all using (public.es_director_de(coro_id))
          with check (public.es_director_de(coro_id));

-- -----------------------------------------------------------------------------
-- La nota de una sugerencia: solo existe con misa y mide 280 como máximo
-- -----------------------------------------------------------------------------
-- Una propuesta general («para Comunión propongo este») no lleva «por qué»:
-- el check lo vuelve imposible también por acción directa, no solo en la UI.

alter table public.sugerencia add column if not exists nota text;
alter table public.sugerencia add constraint sugerencia_nota_check
  check (nota is null or (misa_id is not null and char_length(nota) <= 280));

-- -----------------------------------------------------------------------------
-- guardar_lecturas · reemplazo atómico de las partes de una misa
-- -----------------------------------------------------------------------------
-- Una sola llamada guarda lo que el director confirmó: borra las partes que
-- quedaron vacías, inserta las nuevas y actualiza las que ya existían. Todo en
-- la misma transacción: un parseo parcial no deja la misa a medias.
--
-- `security invoker` a propósito: el delete y el insert pasan por la RLS de
-- `misa_lectura`; `es_director_de` es la comprobación explícita que devuelve un
-- error claro en vez de cero filas afectadas.

create or replace function public.guardar_lecturas(p_misa_id uuid, p_partes jsonb)
returns void language plpgsql security invoker set search_path = public as $$
declare v_coro uuid;
begin
  select coro_id into v_coro from public.misas where id = p_misa_id;
  if v_coro is null then raise exception 'La misa no existe'; end if;
  if not public.es_director_de(v_coro) then raise exception 'No tienes permiso'; end if;

  delete from public.misa_lectura
   where misa_id = p_misa_id
     and tipo not in (
       select x.tipo from jsonb_to_recordset(p_partes) as x(tipo text, texto text)
        where nullif(btrim(x.texto), '') is not null
     );

  insert into public.misa_lectura
    (misa_id, coro_id, tipo, referencia, texto, fuente, fuente_url, traido_en, updated_at)
  select p_misa_id, v_coro, x.tipo, coalesce(x.referencia,''), x.texto,
         coalesce(x.fuente,'manual'), x.fuente_url, x.traido_en, now()
    from jsonb_to_recordset(p_partes) as x(
      tipo text, referencia text, texto text, fuente text, fuente_url text, traido_en timestamptz
    )
   where nullif(btrim(x.texto), '') is not null
  on conflict (misa_id, tipo) do update set
    referencia = excluded.referencia, texto = excluded.texto, fuente = excluded.fuente,
    fuente_url = excluded.fuente_url, traido_en = excluded.traido_en, updated_at = now();
end;
$$;

grant execute on function public.guardar_lecturas(uuid, jsonb) to authenticated;
