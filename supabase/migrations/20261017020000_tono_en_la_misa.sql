-- =============================================================================
-- H27 · El tono de cada canto en la misa — docs/PRD.md §17, «H27».
--
-- «Hay veces que el cantante canta en distintos tonos, así que en la misa hay
--  que escoger, en cada canción, cuál tono va a cantar.» (el dueño, 2026-10-17)
--
-- El tono de la misa es un dato de la FILA de la misa, no del canto ni de la
-- persona: el mismo canto va en E un domingo y en F el siguiente, y en cada misa
-- tiene que ser el mismo para todos los que tocan.
--
-- SEMITONOS, NO NOMBRE DE TONALIDAD: así funciona también en un canto sin
-- tonalidad original declarada, y el nombre («F») se calcula al leer con
-- `transponerAcorde` (§8, cero valores derivados persistidos).
--
-- NULO = SIN FIJAR. La misa se ve como antes de H27: con el tono personal de
-- cada uno (H3). Es el valor de todas las filas que ya existen, así que ninguna
-- misa armada cambia por esta migración.
--
-- RLS: sin políticas nuevas. `misa_cantos_write` ya deja escribir la fila solo
-- al director del coro; fijar el tono es escribir esa fila. Lo comprueba
-- `verificar:rls` (acto 17), en vez de suponerlo.
-- =============================================================================

alter table public.misa_cantos
  add column if not exists transposicion smallint
    check (transposicion between -11 and 11);

comment on column public.misa_cantos.transposicion is
  'H27. Semitonos respecto del cifrado en que se canta este canto en esta misa. NULL = sin fijar: cada persona ve su tono personal.';
