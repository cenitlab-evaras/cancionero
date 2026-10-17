/**
 * La partitura que sigue la música — PRD §21.6.
 *
 * Portado de `motor/partitura-vivo.js`, que comparten el video exportado y el
 * reproductor local: la misma regla para el cursor en los dos lados.
 *
 * Todo tiempo acá es tiempo de PARTITURA en milisegundos (`currentTime × 1000`),
 * no de reloj de pared. Al bajar el tempo el audio corre más lento, pero
 * `currentTime` sigue midiendo la partitura, así que nada de esto conoce la tasa.
 */

export type MomentoCursor = { t: number; x: number; w: number }

/**
 * La x del cursor en el instante t. Entre dos momentos avanza en proporción al
 * tiempo, así la partitura corre pareja en vez de saltar de nota en nota.
 */
export function posicionCursor(t: number, cursor: MomentoCursor[], fin?: number): number {
  if (cursor.length === 0) return 0
  if (t <= cursor[0].t) return cursor[0].x
  let i = 0
  while (i + 1 < cursor.length && cursor[i + 1].t <= t) i++
  const c = cursor[i]
  if (i + 1 < cursor.length) {
    const sig = cursor[i + 1]
    return c.x + ((sig.x - c.x) * (t - c.t)) / (sig.t - c.t)
  }
  const resto = Math.max(1, (fin ?? c.t + 1000) - c.t)
  return c.x + c.w * Math.min(1, (t - c.t) / resto)
}

/** Las notas y sílabas que suenan en t: empezaron y todavía no terminan. */
export function activos<T extends { t0: number; t1: number }>(t: number, elementos: T[]): T[] {
  return elementos.filter((e) => t >= e.t0 && t < e.t1)
}

/**
 * El índice de la nota de una cuerda en t: la última que empezó. Entre dos
 * notas, la anterior; antes de la primera, `null`; después del final, la última.
 * Las notas vienen ordenadas por su inicio, así que se busca por bisección.
 */
export function notaEn(t: number, notas: { t0: number }[]): number | null {
  let bajo = 0
  let alto = notas.length - 1
  let encontrada: number | null = null
  while (bajo <= alto) {
    const medio = (bajo + alto) >> 1
    if (notas[medio].t0 <= t) {
      encontrada = medio
      bajo = medio + 1
    } else {
      alto = medio - 1
    }
  }
  return encontrada
}
