/**
 * Cuánto trabajo tiene la misa — rediseño de lectura, «Regla de complejidad»
 * (docs/superpowers/specs/2026-11-23-rediseno-lectura-design.md).
 *
 * Función PURA: recibe los cantos de una misa —cada uno con su estado y las
 * veces que ya se cantó, que ya vienen del historial— y no consulta nada.
 *
 * El nivel NO se persiste: se calcula al leer (innegociable 4). Sirve para que
 * el director vea, antes de empezar, dónde está el riesgo de esa misa.
 */

import type { EstadoCanto } from './estado-canto'

/**
 * La complejidad de una misa, con los conteos que la explican.
 *
 * `alta` cuando hay al menos un canto en ensayo que nunca se cantó: es el que
 * puede fallar en vivo. `media` cuando todo lo que está en ensayo ya se cantó
 * alguna vez. `baja` cuando no hay nada en ensayo.
 *
 * Se cuenta por id y no por fila: el mismo canto puede aparecer asignado a más
 * de un momento de la misa, y contarlo dos veces inflaría el nivel. Es el mismo
 * criterio de `contarEnEnsayo`.
 *
 * Si por un dato inconsistente el mismo id llegara con historiales distintos,
 * alcanza con que una fila diga que se cantó para que no cuente como «sin
 * cantar»: el canto ya se cantó, y es la lectura que no exagera el riesgo.
 */
export function nivelDeComplejidad(
  cantos: { id: string; estado: EstadoCanto; veces: number }[],
): { nivel: 'baja' | 'media' | 'alta'; enEnsayo: number; sinCantar: number } {
  const enEnsayo = new Set<string>()
  const cantados = new Set<string>()

  for (const canto of cantos) {
    if (canto.estado !== 'en_ensayo') continue
    enEnsayo.add(canto.id)
    if (canto.veces !== 0) cantados.add(canto.id)
  }

  const sinCantar = enEnsayo.size - cantados.size
  const nivel = sinCantar > 0 ? 'alta' : enEnsayo.size > 0 ? 'media' : 'baja'

  return { nivel, enEnsayo: enEnsayo.size, sinCantar }
}
