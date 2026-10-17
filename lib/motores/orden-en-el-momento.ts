/**
 * El orden de los cantos dentro de un momento litúrgico (pedido del dueño,
 * 2026-10-17). Motor PURO: sin base, sin red, sin reloj.
 *
 * El lugar vive en `canto_momentos.orden`. Lo que nunca se ordenó (nulo) va
 * después, por título: así el repertorio se ve como antes hasta que el director
 * lo toca, y un canto nuevo aparece al final de su momento.
 */

export type Direccion = 'arriba' | 'abajo'

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

/** La lista con `id` un lugar más arriba o más abajo. En el borde, igual. */
export function moverEnLista(ids: string[], id: string, direccion: Direccion): string[] {
  const i = ids.indexOf(id)
  const j = direccion === 'arriba' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= ids.length) return ids
  const nuevo = [...ids]
  ;[nuevo[i], nuevo[j]] = [nuevo[j], nuevo[i]]
  return nuevo
}
