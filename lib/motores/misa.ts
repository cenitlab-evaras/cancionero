/**
 * El orden de una misa y cómo se la recorre (H6 · docs/PRD.md §5 y §17).
 *
 * Funciones puras: entra una lista, sale un número o una lista. Sin base, sin
 * red y sin reloj. La misa vive en la base, pero *cómo* se ordena y
 * *cómo* se recorre son reglas de negocio, y las reglas se prueban solas.
 *
 * Vocabulario de §5, sin sinónimos:
 *   · **momento**  — la categoría litúrgica (Entrada, Perdón, Ofertorio…)
 *   · **orden**    — la posición dentro de la misa. NO es el momento:
 *                    dos cantos pueden compartir momento y su orden los separa.
 */

/** Lo mínimo que hace falta saber de un canto ya asignado para ubicar otro. */
export type Asignado = { orden: number; momentoOrden: number }

/**
 * En qué posición entra un canto nuevo, según el momento litúrgico que le toca.
 *
 * La liturgia ya ordenó la misa —Entrada antes que Perdón, Santo antes que
 * Comunión—, así que el director no debería tener que repetir ese orden a mano.
 * Agrega el Santo después del Ofertorio y la Entrada sigue primera.
 *
 * Empate: el canto nuevo va DESPUÉS de los que ya comparten su momento. Dos
 * cantos de comunión son normales, y el que llega segundo se canta segundo;
 * ponerlo antes cambiaría el orden de algo que ya estaba decidido.
 */
export function ordenDeInsercion(asignados: Asignado[], momentoOrden: number): number {
  // Por posición en la lista ordenada, no por el número guardado: después de
  // quitar cantos pueden quedar huecos y el orden guardado no es un índice.
  const enOrden = [...asignados].sort((a, b) => a.orden - b.orden)
  const posterior = enOrden.findIndex((a) => a.momentoOrden > momentoOrden)
  return posterior === -1 ? enOrden.length : posterior
}

/**
 * Renumera una misa desde 0 y sin huecos, respetando el orden recibido.
 *
 * Se usa después de mover o quitar un canto. El índice único
 * `(misa_id, orden)` de la migración no admite empates, así que el
 * choque se evita acá y no se descubre como un error de Postgres.
 */
export function reordenar(idsEnOrden: string[]): { id: string; orden: number }[] {
  return idsEnOrden.map((id, orden) => ({ id, orden }))
}

export type Recorrido = {
  anterior: string | null
  siguiente: string | null
  /** Contada desde 1: es para mostrarla ("3 de 5"), no para indexar. */
  posicion: number
  total: number
}

/**
 * Dónde está el miembro dentro de la misa y a dónde puede ir.
 *
 * Es lo que sostiene "la recorre en orden sin volver al listado": con esto la
 * vista de ejecución puede pintar ← y → sin saber nada de la misa.
 *
 * Ordena por el `orden` GUARDADO, no por cómo vino el array: el "listo cuando"
 * pide que el orden que se ve sea el que se guardó, y una consulta puede
 * devolver las filas como quiera.
 */
export function recorrido(
  cantos: { id: string; orden: number }[],
  actualId: string
): Recorrido {
  const enOrden = [...cantos].sort((a, b) => a.orden - b.orden)
  const i = enOrden.findIndex((c) => c.id === actualId)

  // Un canto que no pertenece a esta misa no tiene vecinos que ofrecer.
  if (i === -1) return { anterior: null, siguiente: null, posicion: 0, total: enOrden.length }

  return {
    anterior: i > 0 ? enOrden[i - 1].id : null,
    siguiente: i < enOrden.length - 1 ? enOrden[i + 1].id : null,
    posicion: i + 1,
    total: enOrden.length,
  }
}
