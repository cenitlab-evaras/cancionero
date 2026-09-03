-- =============================================================================
-- Archivar un canto — docs/PRD.md §16 (la fila del borrado) y §19.2-B10
--
-- §16 dejó el borrado de cantos "sin decidir a propósito": hacía falta definir
-- antes si se archiva, se borra en lógico o se prohíbe. Decidido el 2026-09-03:
-- **se archiva**, y lo hace el director.
--
-- POR QUÉ NO SE BORRA DE VERDAD, con el mecanismo en la mano:
--   `misa_cantos.canto_id` es `on delete cascade`. Un `delete` sobre `cantos`
--   se lleva también todas las filas de las misas PASADAS donde ese canto se
--   cantó, y el historial de H13 —que se calcula sobre esas filas— pierde esas
--   veces sin decir nada. Archivar saca el canto de circulación sin tocar lo
--   que ya ocurrió, y se deshace.
--
-- Y CUESTA UNA LÍNEA PORQUE H10 DEJÓ EL HUECO ABIERTO A PROPÓSITO. El
-- comentario de `20260807000000_estado_canto.sql` decía, textual: «§16 dejó
-- abierto si va a haber un tercer estado (`archivado`). Con `check`, ese día es
-- una línea.» Este es ese día.
--
-- LA RLS NO CAMBIA, y conviene decir por qué no es un olvido: `cantos_write` ya
-- es `es_director_de(coro_id)` desde H1, y archivar es un `update` de `estado`.
-- El miembro no puede escribir un canto, punto — ya está verificado. Lo único
-- que defiende contra un estado inventado es este `check`, igual que en H10.
-- =============================================================================

alter table public.cantos
  drop constraint if exists cantos_estado_check;

alter table public.cantos
  add constraint cantos_estado_check
  check (estado in ('en_ensayo', 'listo', 'archivado'));

comment on column public.cantos.estado is
  'en_ensayo · listo · archivado. `archivado` saca el canto del repertorio y de la búsqueda, pero NO de las misas pasadas ni del historial: lo que se cantó, se cantó. Se deshace desde la vista de archivados.';

-- El listado y la búsqueda filtran por `estado <> 'archivado'` en cada consulta;
-- este índice parcial es el que hace que ese filtro no cueste.
create index if not exists cantos_coro_activos_idx
  on public.cantos (coro_id)
  where estado <> 'archivado';
