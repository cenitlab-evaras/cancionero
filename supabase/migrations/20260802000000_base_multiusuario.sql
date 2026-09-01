-- =============================================================================
-- 00 · Base multiusuario  ·  CANTORAL
-- =============================================================================
-- Perfiles, roles, helpers de autorización, el recurso raíz (coro), el vínculo
-- persona↔coro y los grants.
--
-- Producto de INSTALACIÓN ÚNICA: N coros, N usuarios, sin organizaciones.
-- La pregunta de toda política no es "¿de qué organización es esta fila?" sino
-- "¿tiene este usuario alcance sobre el CORO del que cuelga esta fila?".
--
-- Referencia: docs/PRD.md §7 (modelo) y §8 (autorización).
-- Idempotente: se puede correr dos veces sin romper nada.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · Perfiles — un perfil por usuario de Auth  (clase E)
-- -----------------------------------------------------------------------------
-- `aprobado` es el portón: no hay auto-registro operativo. Un usuario nuevo
-- entra pero no ve nada hasta que un admin lo habilita (PRD §8.4).

create table if not exists public.perfiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  nombre     text,
  rol        text not null default 'miembro'
             check (rol in ('admin', 'miembro', 'externo')),
  aprobado   boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.perfiles.rol is
  'Rol GLOBAL: qué TIPO de cosas puede hacer. El alcance (sobre CUÁLES coros) lo da coro_acceso.rol_local.';
comment on column public.perfiles.aprobado is
  'Portón de acceso. Sin esto en true, el rol no sirve de nada.';

-- -----------------------------------------------------------------------------
-- 2 · El recurso raíz y el vínculo persona↔coro
-- -----------------------------------------------------------------------------

create table if not exists public.coros (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  parroquia  text,
  created_at timestamptz not null default now()
);

create unique index if not exists coros_nombre_uk on public.coros (lower(nombre));

create table if not exists public.coro_acceso (
  id         uuid primary key default gen_random_uuid(),
  perfil_id  uuid not null references public.perfiles(id) on delete cascade,
  coro_id    uuid not null references public.coros(id)    on delete cascade,
  rol_local  text not null check (rol_local in ('director', 'musico')),
  created_at timestamptz not null default now(),
  unique (perfil_id, coro_id)
);

comment on table public.coro_acceso is
  'Vínculo persona↔coro: define SOBRE CUÁLES coros actúa un perfil, y con qué rol_local.';

-- -----------------------------------------------------------------------------
-- 3 · Helpers de autorización
-- -----------------------------------------------------------------------------
-- security definer  → evita recursión infinita cuando una política sobre
--                     perfiles necesita leer perfiles.
-- set search_path   → sin esto, una función security definer es un vector de
--                     escalada de privilegios.
-- stable            → el planificador la evalúa una vez por consulta, no por fila.

create or replace function public.mi_rol()
returns text
language sql stable security definer set search_path = public as $$
  select rol from public.perfiles where id = auth.uid()
$$;

create or replace function public.es_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and rol = 'admin' and aprobado
  )
$$;

-- Interno = del equipo. Todo aprobado que no sea externo.
create or replace function public.es_interno()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and aprobado and rol <> 'externo'
  )
$$;

-- El helper de alcance. Un admin ve todo; el resto, solo sus coros.
-- Exige el portón: un vínculo sin aprobación no da alcance.
create or replace function public.puede_ver_coro(p_coro_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_admin()
      or exists (
        select 1
        from public.coro_acceso a
        join public.perfiles p on p.id = a.perfil_id
        where a.coro_id = p_coro_id
          and a.perfil_id = auth.uid()
          and p.aprobado
      )
$$;

-- Quién escribe el repertorio de un coro: su director (o un admin).
-- Es una decisión explícita del producto (PRD §8.2), no el default es_admin().
create or replace function public.es_director_de(p_coro_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select public.es_admin()
      or exists (
        select 1
        from public.coro_acceso a
        join public.perfiles p on p.id = a.perfil_id
        where a.coro_id = p_coro_id
          and a.perfil_id = auth.uid()
          and a.rol_local = 'director'
          and p.aprobado
      )
$$;

-- -----------------------------------------------------------------------------
-- 4 · RLS — las cinco clases de tabla
-- -----------------------------------------------------------------------------
-- A · recurso raíz         select: puede_ver_coro(id)              write: es_admin()
-- B · cuelga del raíz      select: puede_ver_coro(coro_id)         write: según el hito
-- C · sensible             predicado propio, más estrecho          write: es_admin()
-- D · global sin raíz      select: es_interno()                    write: es_admin()
-- E · identidad y vínculo  select: id = auth.uid() or es_interno() write: es_admin()

alter table public.perfiles    enable row level security;
alter table public.coros       enable row level security;
alter table public.coro_acceso enable row level security;

-- perfiles (E): cada uno se ve a sí mismo; el equipo aprobado ve a los demás.
drop policy if exists perfiles_select on public.perfiles;
create policy perfiles_select on public.perfiles
  for select using (id = auth.uid() or public.es_interno());

drop policy if exists perfiles_write on public.perfiles;
create policy perfiles_write on public.perfiles
  for all using (public.es_admin()) with check (public.es_admin());

-- coros (A)
drop policy if exists coros_select on public.coros;
create policy coros_select on public.coros
  for select using (public.puede_ver_coro(id));

drop policy if exists coros_write on public.coros;
create policy coros_write on public.coros
  for all using (public.es_admin()) with check (public.es_admin());

-- coro_acceso (E): cada uno ve sus vínculos; el director del coro ve los de su coro.
drop policy if exists coro_acceso_select on public.coro_acceso;
create policy coro_acceso_select on public.coro_acceso
  for select using (perfil_id = auth.uid() or public.es_director_de(coro_id));

drop policy if exists coro_acceso_write on public.coro_acceso;
create policy coro_acceso_write on public.coro_acceso
  for all using (public.es_director_de(coro_id))
          with check (public.es_director_de(coro_id));

-- -----------------------------------------------------------------------------
-- 5 · Alta automática del perfil al registrarse  (PRD §8.4)
-- -----------------------------------------------------------------------------
-- Sin este trigger, un usuario recién registrado no tiene perfil y toda política
-- le devuelve falso: entra, no ve nada, y no hay a quién aprobar.
-- Nace con rol 'miembro' y aprobado = false. El portón lo abre un admin.

create or replace function public.crear_perfil_al_registrarse()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.perfiles (id, email, nombre)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'nombre', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists crear_perfil_al_registrarse on auth.users;
create trigger crear_perfil_al_registrarse
  after insert on auth.users
  for each row execute function public.crear_perfil_al_registrarse();

-- -----------------------------------------------------------------------------
-- 6 · Grants
-- -----------------------------------------------------------------------------
-- Sin esto, cada política falla con "permission denied for function" y parece un
-- problema de RLS. Se pierde media tarde buscando en el lugar equivocado.

-- `service_role` va incluido porque es el rol con el que corre la semilla, que
-- es el único uso justificado del cliente admin en este producto (PRD §13).
grant usage on schema public to anon, authenticated, service_role;

grant execute on function public.mi_rol()                 to anon, authenticated, service_role;
grant execute on function public.es_admin()               to anon, authenticated, service_role;
grant execute on function public.es_interno()             to anon, authenticated, service_role;
grant execute on function public.puede_ver_coro(uuid)     to anon, authenticated, service_role;
grant execute on function public.es_director_de(uuid)     to anon, authenticated, service_role;

grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated, service_role;

-- El esquema es `public`, que la Data API expone por defecto: no hay nada que
-- configurar ni en config.toml ni en el Dashboard. Antes esto vivía en un
-- esquema dedicado `cantoral` y había que exponerlo a mano; se migró a `public`
-- el 2026-08-07 (ver PRD §7).
