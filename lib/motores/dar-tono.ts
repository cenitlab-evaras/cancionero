/**
 * «Dar el tono» (herramienta, 2026-10-17). Motor PURO: dado el tono del canto,
 * qué frecuencias suenan. Primero la nota (la tónica), después su acorde, para
 * que el coro arranque afinado sin que nadie tenga que sacar la guitarra.
 *
 * La nota va siempre en la octava central (Do4–Si4): es la que cualquier voz
 * del coro puede tomar, una octava arriba o abajo. El acorde se arma desde la
 * octava de abajo —tónica, tercera, quinta y la tónica otra vez— y solo con la
 * tríada: un `G7` o un `D/F#` dan el tono de Sol y de Re, no un acorde para tocar.
 */

const SEMITONO: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

const TONO = /^([A-G])(#|b)?(.*)$/

/** La frecuencia de una nota MIDI (La4 = 69 = 440 Hz). */
function frecuencia(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

export type NotasDelTono = { nota: number; acorde: number[] }

export function notasDelTono(tonalidad: string): NotasDelTono | null {
  const m = TONO.exec(tonalidad.trim())
  if (!m) return null
  const alteracion = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
  // Do4 = 60. `Cb` y `B#` dan la vuelta dentro de la misma octava.
  const tonica = 60 + ((SEMITONO[m[1]] + alteracion + 12) % 12)
  // Menor es la `m` sola, no la de `maj7`.
  const menor = /^m(?!aj)/.test(m[3].split('/')[0])
  const abajo = tonica - 12
  return {
    nota: frecuencia(tonica),
    acorde: [abajo, abajo + (menor ? 3 : 4), abajo + 7, tonica].map(frecuencia),
  }
}
