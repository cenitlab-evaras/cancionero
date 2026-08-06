import { transponerAcorde } from './transponer'
import type { Catalogo, Digitacion } from './digitaciones'

/**
 * Encuentra cómo se toca un acorde (H5 · docs/PRD.md §9).
 *
 * El catálogo entra por parámetro, no importado adentro: así el motor es puro
 * de verdad y el test puede pasarle uno falso.
 *
 * Devuelve `null` —nunca lanza— cuando no conoce el acorde. Ese `null` no es un
 * fallo: es el estado que §14 diseñó, y la barra lo pinta como
 * "sin digitación para «X»" sin romperse.
 */

export type DigitacionResuelta = {
  /** Lo que el catálogo declara, tal cual: `x32010`. Se muestra bajo el diagrama. */
  cuerdas: string
  /** Seis posiciones, de la 6ª cuerda a la 1ª. `null` muda · `0` al aire · `n` traste. */
  trastes: (number | null)[]
  cejilla: { traste: number; desde: number; hasta: number } | null
  /** Primer traste de la ventana de cinco que dibuja el diagrama. */
  trasteInicial: number
}

/** Cuántos trastes muestra el diagrama. */
const VENTANA = 5

function parsear(cuerdas: string): (number | null)[] {
  return [...cuerdas].map((c) => (c === 'x' || c === 'X' ? null : Number(c)))
}

/**
 * Dónde empieza la ventana del diagrama.
 *
 * Se DERIVA de los trastes, no se declara en el dato: declararla a mano sería
 * un derivado guardado, que es un derivado que algún día miente.
 *
 * Con una cuerda al aire hay que ver la cejuela sí o sí, porque el círculo se
 * dibuja encima de ella. Y si todo cabe en los primeros cinco trastes, la
 * cejuela sigue siendo la referencia que un guitarrista espera.
 */
function calcularTrasteInicial(trastes: (number | null)[]): number {
  const pisados = trastes.filter((t): t is number => t !== null && t > 0)
  if (pisados.length === 0) return 1

  const hayAlAire = trastes.some((t) => t === 0)
  if (hayAlAire || Math.max(...pisados) <= VENTANA) return 1

  return Math.min(...pisados)
}

export function buscarDigitacion(acorde: string, catalogo: Catalogo): DigitacionResuelta | null {
  const nombre = acorde.trim()
  if (nombre === '') return null

  // Los acordes con bajo (`G/B`, `Bm/A`) no tienen entrada, y no caen al acorde
  // base a propósito: `G/B` resolvería en 0 y `A/C#` no en +2, así que el
  // comportamiento cambiaría al transponer. Devolver siempre `null` es estable
  // y tiene su mensaje escrito en §14. Declarado como pendiente en el PRD.
  if (nombre.includes('/')) return null

  // El catálogo está en sostenidos porque `transponer` los emite así; un
  // cifrado sin transponer todavía puede traer un `Bb` escrito a mano.
  // `transponerAcorde(x, 0)` ya normaliza y está probado.
  const normalizado = transponerAcorde(nombre, 0)

  const entrada: Digitacion | undefined = catalogo[normalizado] ?? catalogo[nombre]
  if (!entrada) return null

  const trastes = parsear(entrada.cuerdas)

  return {
    cuerdas: entrada.cuerdas,
    trastes,
    cejilla: entrada.cejilla ?? null,
    trasteInicial: calcularTrasteInicial(trastes),
  }
}
