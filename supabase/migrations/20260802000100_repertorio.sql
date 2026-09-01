-- =============================================================================
-- 01 · Repertorio  ·  H1 "Entrar y ver el repertorio"
-- =============================================================================
-- Solo lo que H1 necesita. Nada adelantado: preferencias_lectura es H3,
-- celebraciones es H6 (docs/PRD.md §17).
--
-- Clases de tabla (PRD §7):
--   momentos_liturgicos · D · global a la instalación
--   autores             · D · global a la instalación
--   cantos              · B · cuelga del coro
--   canto_momentos      · B · cuelga a DOS saltos → coro_id denormalizado
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · Catálogos globales (clase D)
-- -----------------------------------------------------------------------------
-- Sin organizaciones, un catálogo es único para toda la instalación. Eso cambia
-- qué es el producto y está declarado en el PRD (decisión 6), no descubierto acá.

create table if not exists public.momentos_liturgicos (
  id         uuid primary key default gen_random_uuid(),
  codigo     text not null unique,
  nombre     text not null,
  orden      integer not null unique,
  created_at timestamptz not null default now()
);

comment on column public.momentos_liturgicos.orden is
  'Posición del momento dentro de la misa. NO es el orden de un canto dentro de una celebración.';

create table if not exists public.autores (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists autores_nombre_uk on public.autores (lower(nombre));

-- -----------------------------------------------------------------------------
-- 2 · Cantos (clase B)
-- -----------------------------------------------------------------------------
-- El cifrado se almacena en ChordPro con notación americana (PRD decisión 3).
-- La transposición NO se persiste sobre el cifrado (decisión 10): se guarda el
-- número de semitonos en la preferencia del usuario y el motor la aplica al leer.
--
-- Las columnas `fuente_*` existen porque el cancionero de origen exige atribución
-- y cada canto la muestra en pantalla (PRD §18-1). Son nulas en los cantos que
-- el director cree a mano (H8).

create table if not exists public.cantos (
  id                 uuid primary key default gen_random_uuid(),
  coro_id            uuid not null references public.coros(id) on delete cascade,
  titulo             text not null check (length(btrim(titulo)) > 0),
  autor_id           uuid references public.autores(id) on delete set null,
  cifrado            text not null check (length(btrim(cifrado)) > 0),
  tonalidad_original text,
  notas              text,
  fuente_titulo      text,
  fuente_numero      integer,
  fuente_pagina      integer,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Clave natural para que la semilla sea idempotente. Consecuencia asumida:
-- un mismo coro no puede tener dos versiones del mismo título (el funcional
-- heredado marcaba esto como limitación conocida, RN-03). Entre coros distintos
-- sí se puede, que es el caso que importa (PRD decisión 5).
create unique index if not exists cantos_coro_titulo_uk
  on public.cantos (coro_id, lower(titulo));

create index if not exists cantos_coro_idx on public.cantos (coro_id);

-- -----------------------------------------------------------------------------
-- 3 · Canto ↔ momento (clase B, a dos saltos del raíz)
-- -----------------------------------------------------------------------------
-- coro_id DENORMALIZADO y escrito en el insert. Una política con subconsulta
-- anidada (select coro_id from cantos where id = canto_id) se evalúa por fila y
-- es exactamente donde se cuela el bug.

create table if not exists public.canto_momentos (
  id         uuid primary key default gen_random_uuid(),
  canto_id   uuid not null references public.cantos(id) on delete cascade,
  momento_id uuid not null references public.momentos_liturgicos(id) on delete restrict,
  coro_id    uuid not null references public.coros(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (canto_id, momento_id)
);

create index if not exists canto_momentos_coro_idx on public.canto_momentos (coro_id);

-- -----------------------------------------------------------------------------
-- 4 · RLS — activa en la MISMA migración que crea las tablas
-- -----------------------------------------------------------------------------

alter table public.momentos_liturgicos enable row level security;
alter table public.autores             enable row level security;
alter table public.cantos              enable row level security;
alter table public.canto_momentos      enable row level security;

-- D · catálogos globales
drop policy if exists momentos_select on public.momentos_liturgicos;
create policy momentos_select on public.momentos_liturgicos
  for select using (public.es_interno());

drop policy if exists momentos_write on public.momentos_liturgicos;
create policy momentos_write on public.momentos_liturgicos
  for all using (public.es_admin()) with check (public.es_admin());

drop policy if exists autores_select on public.autores;
create policy autores_select on public.autores
  for select using (public.es_interno());

drop policy if exists autores_write on public.autores;
create policy autores_write on public.autores
  for all using (public.es_admin()) with check (public.es_admin());

-- B · cantos. La escritura es del DIRECTOR del coro, decidido a propósito
-- (PRD §8.2): no es el default es_admin() copiado.
drop policy if exists cantos_select on public.cantos;
create policy cantos_select on public.cantos
  for select using (public.puede_ver_coro(coro_id));

drop policy if exists cantos_write on public.cantos;
create policy cantos_write on public.cantos
  for all using (public.es_director_de(coro_id))
          with check (public.es_director_de(coro_id));

-- B · canto_momentos, por su coro_id denormalizado
drop policy if exists canto_momentos_select on public.canto_momentos;
create policy canto_momentos_select on public.canto_momentos
  for select using (public.puede_ver_coro(coro_id));

drop policy if exists canto_momentos_write on public.canto_momentos;
create policy canto_momentos_write on public.canto_momentos
  for all using (public.es_director_de(coro_id))
          with check (public.es_director_de(coro_id));

-- Los grants de tabla los cubre el `alter default privileges` de la migración 00.
