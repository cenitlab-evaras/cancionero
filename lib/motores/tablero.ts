import { CUERDAS_DEL_CORO, cuerdaPorTesitura, type CuerdaDelCoro } from './cuerdas'
import { esTesituraValida } from './ficha'
import type { Inscrito } from './inscripcion'

/**
 * El Inicio como tablero (el dueño, 2026-10-17, opción B de las maquetas:
 * «¿qué tan lista está la misa?»). Motor PURO: cuenta, no consulta. Nada de
 * esto se guarda (PRD §8, regla 3): se calcula cada vez que se abre el Inicio.
 */

export type AvanceDeLaMisa = {
  /** 0–100, redondeado. */
  porcentaje: number
  cantos: number
  /** Cantos con el tono fijado para esta misa (H27). */
  conTono: number
  tocan: number
  sinResponder: number
}

/**
 * El promedio de cuatro partes, cada una entre 0 y 1: que la misa tenga
 * cantos, qué parte de ellos tiene el tono fijado, que alguien se haya anotado
 * a tocar y qué parte del coro respondió. Es la regla que se le mostró al
 * dueño; si cambia, cambian juntos este motor y su test.
 *
 * Un tono fijado en 0 cuenta: fijar el original también es una decisión. Un
 * coro sin miembros no resta por respuestas (no hay a quién esperar).
 */
export function avanceDeLaMisa(e: {
  cantos: { tonoDeMisa: number | null }[]
  tocan: number
  coro: number
  sinResponder: number
}): AvanceDeLaMisa {
  const cantos = e.cantos.length
  const conTono = e.cantos.filter((c) => c.tonoDeMisa !== null).length
  const partes = [
    cantos > 0 ? 1 : 0,
    cantos > 0 ? conTono / cantos : 0,
    e.tocan > 0 ? 1 : 0,
    e.coro > 0 ? Math.max(0, e.coro - e.sinResponder) / e.coro : 1,
  ]
  const porcentaje = Math.round((100 * partes.reduce((a, b) => a + b, 0)) / partes.length)
  return { porcentaje, cantos, conTono, tocan: e.tocan, sinResponder: e.sinResponder }
}

export type VocesQueVan = Record<CuerdaDelCoro, number> & { sinCuerda: number; total: number }

/**
 * Cuántos de los que van a CANTAR hay de cada cuerda, según la tesitura de su
 * ficha, con la misma equivalencia que Ensayar (mezzo → contralto, barítono →
 * bajo). Quien no cargó su tesitura va en `sinCuerda`, para que la suma dé el
 * total. Los que van a tocar no son voces.
 *
 * Las fichas solo las lee el director (H14): para el miembro esto no se arma.
 */
export function vocesQueVan(
  inscritos: Inscrito[],
  fichas: { perfilId: string; tesitura: string | null }[]
): VocesQueVan {
  const tesituraDe = new Map(fichas.map((f) => [f.perfilId, f.tesitura]))
  const voces: VocesQueVan = { soprano: 0, contralto: 0, tenor: 0, bajo: 0, sinCuerda: 0, total: 0 }
  for (const i of inscritos) {
    if (i.aporte !== 'vocal') continue
    const t = tesituraDe.get(i.perfilId)
    const cuerda = esTesituraValida(t) ? (cuerdaPorTesitura(t, [...CUERDAS_DEL_CORO]) as CuerdaDelCoro | null) : null
    if (cuerda) voces[cuerda]++
    else voces.sinCuerda++
    voces.total++
  }
  return voces
}
