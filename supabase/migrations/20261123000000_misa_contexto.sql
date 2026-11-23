-- =============================================================================
-- Celebración y lugar de la misa — texto libre (rediseño de lectura, Task 4,
-- 2026-11-23).
--
-- POR QUÉ:
--   Al armar la misa, el director hoy solo le pone nombre y fecha. En la
--   pantalla nueva esas dos piezas se muestran como contexto junto al título:
--   la celebración litúrgica («Domingo 33 del Tiempo Ordinario») y el lugar
--   («Capilla del colegio»). Son texto libre, como el nombre: sin catálogo que
--   mantener (spec 2026-11-23).
--
--   Las dos nacen NULL: las misas que ya existen se ven exactamente igual que
--   antes. No hay tabla ni política nueva: la RLS de `misas` (lectura del coro,
--   escritura del director) ya cubre estas columnas.
-- =============================================================================

alter table public.misas add column if not exists celebracion text;
alter table public.misas add column if not exists lugar text;

comment on column public.misas.celebracion is
  'Celebración litúrgica en texto libre (p. ej. «Domingo 33 del Tiempo Ordinario»). NULL = sin indicar.';
comment on column public.misas.lugar is
  'Lugar de la misa en texto libre (p. ej. «Capilla del colegio»). NULL = sin indicar.';
