-- =============================================================================
-- El orden de los cantos dentro de cada momento (pedido del dueño, 2026-10-17):
-- «que se puedan mover para arriba y abajo las canciones para definir el orden».
--
-- Vive en el VÍNCULO canto–momento: el mismo canto puede ir primero en la
-- Entrada y último en la Comunión. Nulo = sin ordenar: va después de los
-- ordenados, por título, que es como se veía antes.
--
-- No hay tabla nueva ni política nueva: `canto_momentos_write` ya deja escribir
-- solo al director del coro (es_director_de(coro_id)), y eso es exactamente
-- quién ordena. Los casos van en supabase/seed/verificar-rls.ts.
-- =============================================================================

alter table public.canto_momentos
  add column if not exists orden integer check (orden >= 0);
