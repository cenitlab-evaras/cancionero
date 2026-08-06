/**
 * Los acordes de un cifrado, en orden de primera aparición y sin repetidos
 * (H5 · docs/PRD.md §9).
 *
 * Es lo que alimenta la barra de diagramas. Dos decisiones que conviene que
 * queden escritas acá y no se descubran después:
 *
 *   1. NO depende del ancho de pantalla. Este motor no reutiliza
 *      `renderizarCifrado`, aunque tenga el mismo regex: la lista de acordes de
 *      un canto no puede cambiar porque el teléfono sea más angosto.
 *
 *   2. NO normaliza ni filtra nada. Un `[H9]` entra en la lista tal cual, para
 *      que la barra pueda decir "sin digitación para «H9»" (§14). Descartarlo
 *      acá lo haría desaparecer en silencio.
 *
 * La composición que manda (§9): esto se llama SIEMPRE sobre el cifrado ya
 * transpuesto —`acordesDeCanto(transponer(cifrado, n))`—, nunca sobre el
 * original. Si no, con +2 la pantalla muestra F# y el diagrama dibuja E.
 */

/** Todo lo que esté entre corchetes, esté donde esté — también en `{comment:}` (RN-16). */
const ACORDE_EN_CIFRADO = /\[([^\]\n]+)\]/g

export function acordesDeCanto(cifrado: string): string[] {
  const vistos = new Set<string>()
  const enOrden: string[] = []

  for (const [, acorde] of cifrado.matchAll(ACORDE_EN_CIFRADO)) {
    const nombre = acorde.trim()
    if (nombre === '' || vistos.has(nombre)) continue
    vistos.add(nombre)
    enOrden.push(nombre)
  }

  return enOrden
}
