-- =============================================================================
-- El default de `tamano_letra` sigue al preset Regular (22 px) — Task 2,
-- rediseño de lectura 2026-11-23.
--
-- POR QUÉ:
--   La app pasó a tres presets (18 · 22 · 28) y normaliza al leer, pero la
--   columna seguía con `default 16`. Una fila nueva se crea sin `tamano_letra`
--   en los upserts de `guardarMostrarAcordes` y `guardarHerramientas`: quien
--   nunca eligió tamaño veía Regular (22) hasta que tocaba «ver acordes» o una
--   herramienta, y recién ahí `preferenciasDelPerfil` normalizaba ese 16 a
--   Pequeño (18). Es decir, la letra se le achicaba sin haber tocado el tamaño.
--
--   El default ahora es 22 —el píxel de `TAMANO_POR_DEFECTO` ('regular')—, así
--   que una fila nueva nace ya en un preset válido. No reescribe datos viejos:
--   los 14–32 guardados se siguen normalizando al leer, y el check vigente
--   (14–32 pares) acepta 22.
-- =============================================================================

alter table public.preferencias_perfil alter column tamano_letra set default 22;
