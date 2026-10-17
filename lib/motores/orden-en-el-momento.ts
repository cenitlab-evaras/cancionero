/**
 * El orden de los cantos dentro de un momento litúrgico (pedido del dueño,
 * 2026-10-17). Motor PURO: sin base, sin red, sin reloj.
 *
 * El lugar vive en `canto_momentos.orden`. Lo que nunca se ordenó (nulo) va
 * después, por título: así el repertorio se ve como antes hasta que el director
 * lo toca, y un canto nuevo aparece al final de su momento.
 */

const porTitulo = (a: { titulo: string }, b: { titulo: string }) =>
  a.titulo.localeCompare(b.titulo, 'es', { sensitivity: 'base' })

export function ordenarMomento<T extends { titulo: string; orden: number | null }>(cantos: T[]): T[] {
  return [...cantos].sort((a, b) => {
    if (a.orden !== null && b.orden !== null) return a.orden - b.orden || porTitulo(a, b)
    if (a.orden !== null) return -1
    if (b.orden !== null) return 1
    return porTitulo(a, b)
  })
}

export type Soltar = { id: string; de: string; a: string; indice: number }

/**
 * Las listas de cada momento después de soltar un canto (el dueño, 2026-10-17:
 * «el clásico mover con el dedo», también a otro momento). `indice` es el lugar
 * en el destino una vez sacado el canto. Si el canto ya estaba en el destino
 * —un canto puede ir en varios momentos— queda una sola vez, donde se soltó.
 * Un canto que no está en el origen o un momento que no existe: sin cambios.
 */
export function soltarCanto(
  listas: Record<string, string[]>,
  { id, de, a, indice }: Soltar
): Record<string, string[]> {
  const origen = listas[de]
  const destino = listas[a]
  if (!origen || !destino || !origen.includes(id)) return listas

  const resultado = { ...listas, [de]: origen.filter((x) => x !== id) }
  const sin = (de === a ? resultado[de] : destino).filter((x) => x !== id)
  const lugar = Math.max(0, Math.min(indice, sin.length))
  resultado[a] = [...sin.slice(0, lugar), id, ...sin.slice(lugar)]
  return resultado
}
