/**
 * Auto scroll — H4, RF-21 del funcional.
 *
 * Motor PURO: el tiempo entra como parámetro (`dtMs`), no lo lee de ningún
 * reloj. Así el avance se prueba sin levantar un navegador ni esperar segundos.
 */

export const VELOCIDAD_MIN = 1
export const VELOCIDAD_MAX = 10
export const VELOCIDAD_POR_DEFECTO = 4

/** Píxeles por segundo en el nivel más lento y en el más rápido. */
const PX_MIN = 6
const PX_MAX = 70

/**
 * Un cuadro nunca avanza más de lo que avanzaría en este tiempo. Si la pestaña
 * queda en segundo plano, el navegador entrega un cuadro con un `dt` enorme y
 * sin tope la página saltaría cientos de píxeles de golpe al volver.
 */
const DT_MAXIMO_MS = 1000

/**
 * Velocidad en píxeles por segundo para un nivel del control.
 * Lineal entre los extremos: el músico mueve el control y el cambio se siente
 * proporcional, sin escalones.
 */
export function pixelesPorSegundo(nivel: number): number {
  const n = Math.min(VELOCIDAD_MAX, Math.max(VELOCIDAD_MIN, nivel))
  const proporcion = (n - VELOCIDAD_MIN) / (VELOCIDAD_MAX - VELOCIDAD_MIN)
  return PX_MIN + proporcion * (PX_MAX - PX_MIN)
}

/**
 * Cuánto desplazar en este cuadro, arrastrando la fracción sobrante.
 *
 * El scroll del navegador trabaja en píxeles enteros. A velocidades lentas,
 * cada cuadro pide una fracción de píxel; si se redondeara cuadro a cuadro, el
 * avance se vería a tirones o directamente no avanzaría. Por eso el resto se
 * devuelve y vuelve a entrar en el cuadro siguiente.
 */
export function avanzar(
  resto: number,
  pxPorSegundo: number,
  dtMs: number
): { avance: number; resto: number } {
  const dt = Math.min(Math.max(dtMs, 0), DT_MAXIMO_MS)
  const total = resto + (pxPorSegundo * dt) / 1000
  const avance = Math.floor(total)
  return { avance, resto: total - avance }
}
