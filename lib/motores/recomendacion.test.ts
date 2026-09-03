import { describe, expect, test } from 'vitest'
import { recomendar, type Candidato } from './recomendacion'

/**
 * H18 · Recomendación al armar — el "listo cuando" de §17, y B1-C de §19.2.
 *
 * Lo que este motor tiene que garantizar:
 *
 *  1. **Determinista y explicable en una frase** (§10): «primero el que hace más
 *     tiempo que no se canta». Si el orden no se puede explicar, el director no
 *     lo usa para decidir — y una recomendación que no se usa es peso muerto.
 *  2. **«Hace ocho meses» y «nunca se cantó» son consejos distintos**, y por eso
 *     van en dos grupos. Mezclarlos pondría arriba los 74 cantos importados —que
 *     nunca se cantaron— y enterraría justo lo que el director no puede calcular
 *     de memoria.
 *  3. **Un canto archivado no se recomienda jamás.** Salió de circulación; que
 *     vuelva por acá sería traerlo por la ventana.
 */

const c = (
  cantoId: string,
  ultima: string | null,
  estado: 'listo' | 'en_ensayo' | 'archivado' = 'listo'
): Candidato => ({ cantoId, titulo: cantoId, estado, ultima })

const HOY = '2026-09-03'

describe('recomendar', () => {
  test('primero el que hace MÁS tiempo que no se canta', () => {
    const r = recomendar([c('reciente', '2026-08-30'), c('viejo', '2026-01-15')], HOY)
    expect(r.hacenFalta.map((x) => x.cantoId)).toEqual(['viejo', 'reciente'])
  })

  test('trae los días, para que la pantalla no los recalcule', () => {
    const r = recomendar([c('uno', '2026-08-27')], HOY)
    expect(r.hacenFalta[0]!.diasDesdeUltima).toBe(7)
  })

  test('los que NUNCA se cantaron van aparte, no arriba', () => {
    // Es la decisión del hito. Si «nunca» contara como «hace infinito tiempo»,
    // los 74 importados coparían el tope y el consejo útil quedaría abajo.
    const r = recomendar([c('nunca', null), c('viejo', '2026-01-15')], HOY)
    expect(r.hacenFalta.map((x) => x.cantoId)).toEqual(['viejo'])
    expect(r.nuncaCantados.map((x) => x.cantoId)).toEqual(['nunca'])
  })

  test('un canto archivado no se recomienda, ni siquiera si nunca se cantó', () => {
    const r = recomendar([c('fuera', null, 'archivado'), c('tambien', '2026-01-01', 'archivado')], HOY)
    expect(r.hacenFalta).toEqual([])
    expect(r.nuncaCantados).toEqual([])
  })

  test('los que están EN ENSAYO sí se recomiendan', () => {
    // El dueño lo decidió el 2026-09-03, en contra de lo que anticipaba B10.
    // Con 74 cantos importados en ensayo, excluirlos vaciaba la recomendación.
    const r = recomendar([c('ensayando', '2026-02-01', 'en_ensayo')], HOY)
    expect(r.hacenFalta.map((x) => x.cantoId)).toEqual(['ensayando'])
  })

  test('a igual antigüedad, orden alfabético: el mismo día se ve lo mismo', () => {
    const r = recomendar([c('zeta', '2026-06-01'), c('alfa', '2026-06-01')], HOY)
    expect(r.hacenFalta.map((x) => x.cantoId)).toEqual(['alfa', 'zeta'])
  })

  test('entre los nunca cantados, primero los que el coro ya da por listos', () => {
    // Un canto «listo» que nunca se cantó está más cerca de poder cantarse que
    // uno que todavía se está sacando.
    const r = recomendar([c('b-ensayo', null, 'en_ensayo'), c('a-listo', null, 'listo')], HOY)
    expect(r.nuncaCantados.map((x) => x.cantoId)).toEqual(['a-listo', 'b-ensayo'])
  })

  test('sin candidatos devuelve dos listas vacías, no null', () => {
    expect(recomendar([], HOY)).toEqual({ hacenFalta: [], nuncaCantados: [] })
  })

  test('un canto cantado HOY cuenta como 0 días, no como nunca', () => {
    const r = recomendar([c('hoy', HOY)], HOY)
    expect(r.hacenFalta[0]!.diasDesdeUltima).toBe(0)
    expect(r.nuncaCantados).toEqual([])
  })
})
