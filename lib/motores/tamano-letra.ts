/**
 * El tamaño de letra del cifrado — RN-14, revisada el 2026-10-17.
 *
 * Es de la PERSONA (`preferencias_perfil.tamano_letra`), no del canto: quien ve
 * poco lo elige una vez y vale en todo el repertorio y en toda la misa. La
 * transposición sí sigue siendo por canto.
 *
 * El tope sube de 24 a 32. `cifrado.tsx` parte el verso en menos columnas a
 * medida que crece, así que en un teléfono angosto el aumento se ve de verdad.
 */

export const TAMANO_MIN = 14
export const TAMANO_MAX = 32
export const TAMANO_PASO = 2
export const TAMANO_POR_DEFECTO = 16

export function esTamanoValido(valor: unknown): valor is number {
  return (
    typeof valor === 'number' &&
    Number.isInteger(valor) &&
    valor >= TAMANO_MIN &&
    valor <= TAMANO_MAX &&
    valor % TAMANO_PASO === 0
  )
}

/**
 * Un paso más grande (`+1`) o más chico (`-1`), siempre dentro de la grilla.
 *
 * Un valor fuera de la grilla (un 17) se ajusta hacia donde se pidió en vez de
 * saltar dos pasos; uno fuera del rango vuelve al extremo más cercano.
 */
export function cambiarTamano(actual: number, direccion: 1 | -1): number {
  const enGrilla = actual % TAMANO_PASO === 0
  const siguiente = enGrilla
    ? actual + direccion * TAMANO_PASO
    : direccion > 0
      ? Math.ceil(actual / TAMANO_PASO) * TAMANO_PASO
      : Math.floor(actual / TAMANO_PASO) * TAMANO_PASO
  return Math.min(TAMANO_MAX, Math.max(TAMANO_MIN, siguiente))
}
