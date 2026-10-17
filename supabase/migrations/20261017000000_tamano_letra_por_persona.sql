-- =============================================================================
-- El tamaño de letra pasa a ser de la PERSONA — crítica de diseño del
-- 2026-10-17, P0. docs/PRD.md §17.1-quaterdecies.
--
-- QUÉ ESTABA MAL:
--   H3 guardó el tamaño junto con la transposición, por canto
--   (`preferencias_lectura`, único por perfil × canto). Para quien ve poco eso
--   significaba agrandar CADA canto, también en plena misa: «Abre tu jardín»
--   abría en 18 y el siguiente canto de la misa volvía a 16. PRODUCT.md dice
--   que el tamaño es «un control de primera clase»; por canto era una tarea
--   que se repetía en cada página.
--
--   La transposición SÍ es del canto (la voz no llega a ese canto en ese tono)
--   y se queda donde está. El tamaño es de los ojos de quien lee.
--
-- POR QUÉ ACÁ:
--   `preferencias_perfil` ya es la tabla de lo que vale en todo el repertorio
--   (H11, `mostrar_acordes`), con su política de clase C verificada: cada uno
--   ve y escribe solo la suya. Una columna más hereda esa política sin tocarla.
--
-- EL TOPE SUBE DE 24 A 32 (RN-14 revisada):
--   En un teléfono de 360 px el ajuste al ancho dejaba los 24 pedidos en unos
--   21 reales. Con 32, `cifrado.tsx` parte el verso en menos columnas y la letra
--   crece de verdad. Siguen los pasos de 2.
--
-- LO QUE NO SE BORRA TODAVÍA:
--   `preferencias_lectura.tamano_letra` queda, sin uso. La base migra antes que
--   la app (§18-19): si esta migración la borrara, la versión desplegada
--   reventaría al guardar una transposición hasta el próximo Deploy. Se borra en
--   una migración posterior, cuando esta versión ya esté en producción.
-- =============================================================================

alter table public.preferencias_perfil
  add column if not exists tamano_letra integer not null default 16
    check (tamano_letra between 14 and 32 and tamano_letra % 2 = 0);

comment on column public.preferencias_perfil.tamano_letra is
  'Tamaño de letra del cifrado en px (14–32, pasos de 2). De la persona, en todo el repertorio. Reemplaza a preferencias_lectura.tamano_letra, que queda sin uso.';

-- Nadie pierde el tamaño que ya había elegido: se lleva el MÁS GRANDE que haya
-- usado en algún canto. El más grande y no el último, porque quien agrandó un
-- canto es quien lo necesita, y quedarse con un 16 que tocó al pasar sería
-- volver a achicarle la letra sin avisar.
insert into public.preferencias_perfil (perfil_id, tamano_letra)
select perfil_id, max(tamano_letra)
from public.preferencias_lectura
group by perfil_id
on conflict (perfil_id) do update
  set tamano_letra = greatest(public.preferencias_perfil.tamano_letra, excluded.tamano_letra);

comment on table public.preferencias_perfil is
  'Preferencias de lectura de una persona, válidas en TODO el repertorio: acordes sí/no (H11) y tamaño de letra (2026-10-17). La transposición es por canto y vive en preferencias_lectura (PRD §7).';
