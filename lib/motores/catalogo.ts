import { coincideBusqueda, normalizarBusqueda } from './busqueda'
import type { EstadoCanto } from './estado-canto'

/**
 * «Canciones» — todas las canciones del coro, una vez cada una (pedido del
 * dueño, 2026-10-17). Motor PURO: sin base, sin red, sin reloj.
 *
 * En el repertorio una canción sale en cada momento donde está, y así no se
 * puede saber cuántas hay. Acá va una por fila, con sus momentos al lado, y las
 * que entraron más de una vez (dos cantos con el mismo título, por ejemplo de
 * dos cancioneros) se marcan como repetidas.
 */

export type CancionDeCatalogo = {
  id: string
  titulo: string
  autor: string | null
  tonalidadOriginal: string | null
  estado: EstadoCanto
  /** Los códigos de sus momentos litúrgicos. */
  momentos: string[]
  conPartitura: boolean
  /** Su partitura tiene estrofas de solista (2026-10-17). */
  conSolistas: boolean
}

export type FiltrosDeCatalogo = {
  texto?: string
  momento?: string
  estado?: EstadoCanto
  partitura?: 'con' | 'sin'
  soloRepetidas?: boolean
  soloConSolistas?: boolean
}

/**
 * Cuándo dos títulos son la misma canción: sin tildes, mayúsculas, signos ni
 * espacios de más. La ñ se respeta (`normalizarBusqueda`): «Señor» no es «Senor».
 */
export function claveDeTitulo(titulo: string): string {
  return normalizarBusqueda(titulo.replace(/[^\p{L}\p{N}\s]/gu, ' '))
}

/** Cuántas veces está cada canción repetida, por id. Las que están una vez no salen. */
export function repetidas(canciones: { id: string; titulo: string }[]): Map<string, number> {
  const porClave = new Map<string, string[]>()
  for (const c of canciones) {
    const k = claveDeTitulo(c.titulo)
    porClave.set(k, [...(porClave.get(k) ?? []), c.id])
  }
  const veces = new Map<string, number>()
  for (const ids of porClave.values()) {
    if (ids.length > 1) for (const id of ids) veces.set(id, ids.length)
  }
  return veces
}

/** Las canciones que pasan todos los filtros, en el mismo orden. */
export function filtrarCatalogo(
  canciones: CancionDeCatalogo[],
  f: FiltrosDeCatalogo,
  veces: Map<string, number>
): CancionDeCatalogo[] {
  return canciones.filter(
    (c) =>
      coincideBusqueda({ titulo: c.titulo, autor: c.autor }, f.texto ?? '') &&
      (!f.momento || c.momentos.includes(f.momento)) &&
      (!f.estado || c.estado === f.estado) &&
      (!f.partitura || c.conPartitura === (f.partitura === 'con')) &&
      (!f.soloRepetidas || veces.has(c.id)) &&
      (!f.soloConSolistas || c.conSolistas)
  )
}
