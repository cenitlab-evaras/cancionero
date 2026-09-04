-- =============================================================================
-- H19-A · Versionado del cifrado — docs/PRD.md §17, §18-13 y §19.2-B8
--
-- §18-13 lo pedía con estas palabras: «con repertorio compartido, una corrección
-- equivocada es silenciosa e irreversible: no se sabe quién cambió qué ni se
-- puede volver atrás». Esto lo cierra, y es lo que desbloquea corregir acordes
-- en el lugar (B8 B/C), que multiplica las ediciones chicas.
--
-- DOS DECISIONES QUE SON EL HITO, no detalles de implementación:
--
-- 1. EL RASTRO LO ESCRIBE LA BASE, NO LA APLICACIÓN. Si la versión la guardara
--    la server action, bastaría un `update` hecho por fuera de esa pantalla
--    —otra ruta, un script, un POST armado a mano, la próxima función que
--    alguien escriba con prisa— para que la corrección no dejara huella. Un
--    trigger no se olvida. Y `auth.uid()` dentro del trigger dice quién fue sin
--    que nadie tenga que pasarlo: no hay campo de formulario que falsificar.
--
-- 2. NADIE PUEDE ESCRIBIR EN ESTA TABLA. Ni el miembro, ni el director, ni el
--    admin. La tabla tiene RLS activa y **ninguna política de escritura**, más
--    un `revoke` explícito encima. Un historial que la parte interesada puede
--    editar o borrar no es un historial: es una sugerencia. El trigger entra
--    igual porque es `security definer`.
--
-- Lo que se guarda es la versión **saliente**: el cifrado que estaba antes del
-- cambio. Así `cantos.cifrado` sigue siendo la única verdad del texto actual y
-- no hay valor derivado persistido (innegociable 4). Un canto sin filas acá es
-- un canto que nunca se editó — que se dice así, no se muestra como lista vacía.
-- =============================================================================

create table if not exists public.canto_version (
  id         uuid primary key default gen_random_uuid(),
  canto_id   uuid not null,
  coro_id    uuid not null references public.coros(id) on delete cascade,

  -- El cifrado que estaba guardado ANTES de la edición que creó esta fila.
  cifrado    text not null,

  -- Quién hizo el cambio que dejó atrás esta versión. NULO cuando el `update`
  -- no vino de una sesión: la semilla y los importadores usan la clave de
  -- servicio y no tienen `auth.uid()`. Se muestra como tal, no se inventa.
  reemplazado_por uuid references public.perfiles(id) on delete set null,
  reemplazado_en  timestamptz not null default now(),

  -- La lección de H15 y H17 aplicada de entrada: `coro_id` va denormalizado
  -- para que la política no tenga que subir por `canto_id` en cada fila, y la
  -- foránea COMPUESTA vuelve imposible que apunte al coro equivocado.
  --
  -- `canto_id` NO declara además su foránea simple, a propósito: dos relaciones
  -- entre las mismas tablas rompen los embeds de PostgREST con `PGRST201`. Ya
  -- costó una pantalla el 2026-09-03.
  constraint version_canto_del_mismo_coro
    foreign key (canto_id, coro_id) references public.cantos (id, coro_id) on delete cascade
);

comment on table public.canto_version is
  'H19-A. El cifrado que un canto tenía ANTES de cada edición, con quién lo cambió y cuándo. La escribe un trigger, no la aplicación; nadie tiene permiso de escritura sobre ella (PRD §17, §18-13).';
comment on column public.canto_version.cifrado is
  'La versión SALIENTE: lo que estaba guardado antes del cambio. La vigente vive en cantos.cifrado.';
comment on column public.canto_version.reemplazado_por is
  'Quién hizo el cambio. Nulo si el update no vino de una sesión (semilla, importadores).';

-- El historial se lee siempre de un canto y del más reciente al más viejo.
create index if not exists canto_version_canto_idx
  on public.canto_version (canto_id, reemplazado_en desc);

-- -----------------------------------------------------------------------------
-- El trigger que no se olvida
-- -----------------------------------------------------------------------------
-- `after update` y no `before`: registra lo que de verdad quedó escrito, después
-- de que la RLS de `cantos` dejó pasar el cambio.
--
-- La condición `is distinct from` es la que evita llenar la tabla de ruido:
-- guardar un canto sin tocarle el cifrado —cambiar el estado, la fuente, el
-- momento— no crea una versión. Solo se versiona lo que §18-13 dice que importa.

create or replace function public.guardar_version_del_cifrado()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.canto_version (canto_id, coro_id, cifrado, reemplazado_por)
  values (
    old.id,
    old.coro_id,
    old.cifrado,
    -- EL SUBSELECT NO ES ADORNO. `reemplazado_por` tiene foránea contra
    -- `perfiles`, y un `auth.uid()` sin perfil la haría fallar — abortando el
    -- `update` de `cantos` que la disparó. Es decir: un dato de auditoría
    -- incompleto dejaría al director sin poder editar NINGÚN canto. El rastro
    -- no puede tener ese poder. Sin perfil, se guarda nulo y se dice
    -- «Sin identificar», que es lo que de verdad se sabe.
    (select p.id from public.perfiles p where p.id = auth.uid())
  );
  return null;
end;
$$;

comment on function public.guardar_version_del_cifrado() is
  'H19-A. Deja la versión saliente en canto_version. `security definer` porque nadie —tampoco el director— tiene permiso de escritura sobre esa tabla.';

drop trigger if exists cantos_versionar_cifrado on public.cantos;
create trigger cantos_versionar_cifrado
  after update on public.cantos
  for each row
  when (old.cifrado is distinct from new.cifrado)
  execute function public.guardar_version_del_cifrado();

-- -----------------------------------------------------------------------------
-- RLS — activa en la MISMA migración que crea la tabla
-- -----------------------------------------------------------------------------

alter table public.canto_version enable row level security;

-- Lee TODO EL CORO, no solo el director. PRODUCT lo pide con todas las letras:
-- «que la corrección que hace un músico le llegue a los demás». El que abre un
-- canto y ve un acorde distinto al que recuerda tiene derecho a ver que cambió
-- ayer y quién lo cambió, sin preguntarle a nadie.
drop policy if exists canto_version_select on public.canto_version;
create policy canto_version_select on public.canto_version
  for select using (public.puede_ver_coro(coro_id));

-- NO HAY POLÍTICA DE ESCRITURA, Y LA AUSENCIA ES LA REGLA. Con RLS activa, sin
-- política, todo insert/update/delete se rechaza para cualquiera. El `revoke`
-- de abajo lo dice además a nivel de permiso, porque la migración 00 concede
-- las cuatro operaciones sobre toda tabla nueva por `alter default privileges`,
-- y confiar en que "no hay policy" es confiar en que nadie agregue una sin
-- pensar.
revoke insert, update, delete on public.canto_version from authenticated;

grant execute on function public.guardar_version_del_cifrado() to anon, authenticated, service_role;
