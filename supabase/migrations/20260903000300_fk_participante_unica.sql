-- =============================================================================
-- H15 · una sola foránea de `misa_participante` hacia `misas`
--
-- LO QUE PASÓ, porque el error es instructivo y conviene que quede escrito:
-- la migración anterior dejó DOS caminos de `misa_participante` a `misas`:
--
--   1. `misa_id uuid references public.misas(id)`      — la de la columna
--   2. `(misa_id, coro_id) references misas(id, coro_id)` — la compuesta que
--      cierra el agujero del `coro_id` denormalizado
--
-- Las dos son correctas y la base estaba bien. El que se rompió fue PostgREST:
-- con dos relaciones entre las mismas tablas no puede resolver un embed y
-- devuelve `PGRST201 · Could not embed because more than one relationship was
-- found`. El listado de misas —que cuenta los anotados— caía con eso.
--
-- SE VA LA SIMPLE, NO LA COMPUESTA. La compuesta hace todo lo que hacía la
-- otra y además lo que la otra no hacía: `misa_id` y `coro_id` son ambos NOT
-- NULL, así que la compuesta garantiza igual que la misa exista, y encima
-- garantiza que sea la misa DEL CORO de la fila. Quedarse con la simple habría
-- reabierto exactamente el agujero que el hito cerró.
-- =============================================================================

alter table public.misa_participante
  drop constraint if exists misa_participante_misa_id_fkey;
