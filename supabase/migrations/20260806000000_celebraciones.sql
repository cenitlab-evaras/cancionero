-- =============================================================================
-- H6 · Celebraciones — docs/PRD.md §7, §8.2 y decisión 2
--
-- Una celebración es UNA MISA con nombre y fecha, no una lista de reproducción
-- libre (decisión 2). Cada fila de `celebracion_cantos` es un canto en un
-- momento, con su orden dentro de la misa.
--
-- RLS activa en la MISMA migración que crea las tablas. La lectura es de todo
-- el coro; la escritura, solo del director — igual que el repertorio, y por la
-- misma razón: el músico toca, el director arma (PRD §8.2).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · Celebraciones (clase B, cuelga del raíz a un salto)
-- -----------------------------------------------------------------------------

create table if not exists public.celebraciones (
  id         uuid primary key default gen_random_uuid(),
  coro_id    uuid not null references public.coros(id) on delete cascade,
  nombre     text not null check (btrim(nombre) <> ''),
  -- Nullable a propósito: un ensayo o una lista de trabajo no tiene fecha
  -- (PRD §18-6). Si algún día estorba, agregar `tipo` es una columna, no un
  -- rediseño.
  fecha      date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists celebraciones_coro_idx on public.celebraciones (coro_id);
-- El listado de §12 es "por fecha descendente": se indexa como se lee.
create index if not exists celebraciones_coro_fecha_idx
  on public.celebraciones (coro_id, fecha desc nulls last);

-- -----------------------------------------------------------------------------
-- 2 · Cantos de la celebración (clase B, a DOS saltos del raíz)
-- -----------------------------------------------------------------------------
-- `coro_id` DENORMALIZADO y escrito en el insert, como en `canto_momentos`.
-- Una política con subconsulta anidada se evalúa fila por fila y es justo donde
-- se cuela el bug (PRD §7).

create table if not exists public.celebracion_cantos (
  id             uuid primary key default gen_random_uuid(),
  celebracion_id uuid not null references public.celebraciones(id) on delete cascade,
  canto_id       uuid not null references public.cantos(id) on delete cascade,
  momento_id     uuid not null references public.momentos_liturgicos(id) on delete restrict,
  -- La posición dentro de la misa. NO es el momento: dos cantos pueden
  -- compartir momento y su orden los separa (PRD §5).
  orden          integer not null check (orden >= 0),
  coro_id        uuid not null references public.coros(id) on delete cascade,
  created_at     timestamptz not null default now(),
  -- Un canto no se repite dentro de la misma celebración.
  unique (celebracion_id, canto_id)
);

-- El orden es único dentro de una celebración: sin esto, dos cantos podrían
-- compartir posición y "el orden que ve es el que se guardó" dejaría de ser
-- comprobable. `deferrable` para poder reordenar en una sola transacción sin
-- pelear con posiciones intermedias.
create unique index if not exists celebracion_cantos_orden_uk
  on public.celebracion_cantos (celebracion_id, orden);

create index if not exists celebracion_cantos_coro_idx
  on public.celebracion_cantos (coro_id);
create index if not exists celebracion_cantos_celebracion_idx
  on public.celebracion_cantos (celebracion_id, orden);

-- -----------------------------------------------------------------------------
-- 3 · RLS — activa en la MISMA migración que crea las tablas
-- -----------------------------------------------------------------------------

alter table public.celebraciones      enable row level security;
alter table public.celebracion_cantos enable row level security;

-- B · celebraciones. Lee todo el coro; escribe el director.
drop policy if exists celebraciones_select on public.celebraciones;
create policy celebraciones_select on public.celebraciones
  for select using (public.puede_ver_coro(coro_id));

drop policy if exists celebraciones_write on public.celebraciones;
create policy celebraciones_write on public.celebraciones
  for all using (public.es_director_de(coro_id))
          with check (public.es_director_de(coro_id));

-- B · celebracion_cantos, por su coro_id denormalizado.
drop policy if exists celebracion_cantos_select on public.celebracion_cantos;
create policy celebracion_cantos_select on public.celebracion_cantos
  for select using (public.puede_ver_coro(coro_id));

drop policy if exists celebracion_cantos_write on public.celebracion_cantos;
create policy celebracion_cantos_write on public.celebracion_cantos
  for all using (public.es_director_de(coro_id))
          with check (public.es_director_de(coro_id));

-- Los grants de tabla los cubre el `alter default privileges` de la migración 00.
