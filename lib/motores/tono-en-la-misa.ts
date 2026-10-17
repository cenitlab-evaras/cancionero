import { normalizarSemitonos, transponerAcorde } from './transponer'

/**
 * H27 · El tono de cada canto en la misa — docs/PRD.md §17, «H27».
 *
 * El tono de la misa vive en la FILA de la misa (`misa_cantos.transposicion`),
 * en semitonos respecto del cifrado. Nulo = sin fijar.
 */

/**
 * Con qué tono se ve un canto dentro de la misa.
 *
 * Fijado, gana sobre el personal: es el que va a cantar el cantante, y todos
 * los que tocan tienen que estar en el mismo. Fijado en 0 también gana —«en el
 * original» es una decisión, no un vacío—. Sin fijar, la misa se ve como antes
 * de H27: con el tono personal de cada uno (H3).
 */
export function tonoEnLaMisa(
  deLaMisa: number | null,
  personal: number
): { semitonos: number; fijado: boolean } {
  return deLaMisa === null
    ? { semitonos: personal, fijado: false }
    : { semitonos: deLaMisa, fijado: true }
}

/** Un semitono más arriba o más abajo. Sin fijar, se parte del original del cifrado. */
export function cambiarTonoDeMisa(actual: number | null, direccion: 1 | -1): number {
  return normalizarSemitonos((actual ?? 0) + direccion)
}

/** Lo que acepta la columna: entero entre −11 y 11, o nulo. */
export function esTonoDeMisa(valor: unknown): valor is number | null {
  return (
    valor === null ||
    (typeof valor === 'number' && Number.isInteger(valor) && valor >= -11 && valor <= 11)
  )
}

/** El nombre de la tonalidad con que va el canto en esta misa: «F», o la original sin fijar. */
export function tonalidadDeLaFila(original: string | null, deLaMisa: number | null): string | null {
  if (!original) return null
  return deLaMisa === null ? original : transponerAcorde(original, deLaMisa)
}
