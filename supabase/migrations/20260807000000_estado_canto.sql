-- =============================================================================
-- H10 · Estado del canto — docs/PRD.md §17, y B10 del backlog de §19
--
-- Una columna. H10 no crea tablas ni toca la autorización, y eso es a propósito:
-- §19.3 puso a B10 primera justamente porque el estado es del CANTO —no de una
-- persona— y por lo tanto lo escribe quien ya escribe el canto: el director.
--
-- Por qué no hay política nueva:
--   `cantos` tiene RLS desde H1 y su política de escritura es
--   `cantos_write · for all using (es_director_de(coro_id))`. Un `update` de
--   esta columna cae ahí adentro sin agregar nada. Aflojar o duplicar la
--   política para "el estado" sería inventar una segunda puerta a la misma
--   tabla — exactamente lo que §8.3 llama un bug.
--
--   El día que el estado lo mueva alguien que NO es director (B9/H16, el músico
--   que sugiere), eso no será un `update` sobre `cantos`: será una fila propia
--   en otra tabla, con su propia política. Ver §19.5.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · La columna
-- -----------------------------------------------------------------------------
-- `listo` por defecto, y es la decisión correcta para lo que ya existe: los 12
-- cantos sembrados son los que el coro canta hoy. Si el default fuera
-- `en_ensayo`, la migración marcaría todo el repertorio como "no se puede
-- cantar" y habría que corregirlo a mano canto por canto.
--
-- Guardado como texto con `check`, no como enum de Postgres: agregar un valor a
-- un enum es un `alter type` que no corre dentro de una transacción con otras
-- sentencias, y §16 dejó abierto si va a haber un tercer estado (`archivado`).
-- Con `check`, ese día es una línea.

alter table public.cantos
  add column if not exists estado text not null default 'listo';

alter table public.cantos
  drop constraint if exists cantos_estado_check;

alter table public.cantos
  add constraint cantos_estado_check check (estado in ('en_ensayo', 'listo'));

comment on column public.cantos.estado is
  'En qué punto está el canto dentro del coro: en_ensayo (se está sacando) o listo (el coro lo canta). NO es el momento litúrgico, y NO es una sugerencia: sugerir es de una persona, el estado es del canto (PRD §5, §19.4).';

-- -----------------------------------------------------------------------------
-- 2 · Sin índice, a propósito
-- -----------------------------------------------------------------------------
-- El listado ya filtra por `coro_id` —que sí tiene índice desde H1— y el estado
-- se resuelve sobre las filas de un coro, que son decenas. Un índice acá sería
-- carga de escritura sin lectura que lo aproveche.
