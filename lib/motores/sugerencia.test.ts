import { describe, expect, test } from 'vitest'
import { rankear, yaSugirio, type Sugerencia } from './sugerencia'

/**
 * H17 · Sugerencias y ranking — el "listo cuando" de §17, y B9 de §19.2.
 *
 * Lo que este motor tiene que garantizar:
 *
 *  1. **Contar y ordenar, nada más.** §10 exige que la inteligencia del producto
 *     sea determinista: el ranking es un recuento, y dos personas mirándolo el
 *     mismo día ven lo mismo.
 *  2. **Las generales y las de misa NO se suman.** Contestan preguntas
 *     distintas —«qué quiere cantar el coro» y «qué pedimos para el domingo»— y
 *     un número que las mezcle no significa ninguna de las dos. Es la
 *     contradicción que §18-12 anticipó, resuelta separando en vez de arbitrando.
 *  3. **A igual cantidad, primero la más reciente**, como hace el historial de
 *     H13: entre dos propuestas empatadas, la que se pidió hace poco es la que
 *     está viva.
 */

const s = (
  cantoId: string,
  perfilId: string,
  momentoId = 'comunion',
  misaId: string | null = null,
  creada = '2026-09-01T10:00:00Z'
): Sugerencia => ({
  cantoId,
  titulo: cantoId,
  perfilId,
  nombre: perfilId,
  momentoId,
  momentoNombre: momentoId,
  misaId,
  creada,
})

describe('rankear', () => {
  test('ordena por cuántas personas lo pidieron', () => {
    const r = rankear([
      s('alma', 'ana'),
      s('alma', 'juan'),
      s('pescador', 'luis'),
      s('alma', 'maria'),
    ])
    expect(r.map((x) => [x.cantoId, x.cuantas])).toEqual([
      ['alma', 3],
      ['pescador', 1],
    ])
  })

  test('trae quién propuso cada uno, en el orden en que se sumaron', () => {
    const r = rankear([
      s('alma', 'ana', 'comunion', null, '2026-09-01T10:00:00Z'),
      s('alma', 'juan', 'comunion', null, '2026-09-02T10:00:00Z'),
    ])
    expect(r[0]!.quienes).toEqual(['ana', 'juan'])
  })

  test('el mismo canto en DOS momentos son dos filas del ranking, no una', () => {
    // Proponer «Alma misionera» para Comunión y para Ofertorio son dos
    // propuestas distintas: el director elige por momento, no por canto.
    const r = rankear([s('alma', 'ana', 'comunion'), s('alma', 'juan', 'ofertorio')])
    expect(r).toHaveLength(2)
    expect(r.map((x) => x.momentoId).sort()).toEqual(['comunion', 'ofertorio'])
  })

  test('a igual cantidad, primero la más reciente', () => {
    const r = rankear([
      s('vieja', 'ana', 'comunion', null, '2026-05-01T10:00:00Z'),
      s('nueva', 'juan', 'comunion', null, '2026-09-01T10:00:00Z'),
    ])
    expect(r.map((x) => x.cantoId)).toEqual(['nueva', 'vieja'])
  })

  test('LAS GENERALES Y LAS DE MISA NO SE SUMAN', () => {
    // El caso que §18-12 anticipó. Si se sumaran, «Alma misionera» diría 2 y
    // ese 2 no contestaría ni «lo quiere el coro» ni «lo pidieron para el
    // domingo». Se rankean por separado y se muestran en dos bloques.
    const generales = rankear([s('alma', 'ana', 'comunion', null)])
    const deMisa = rankear([s('alma', 'juan', 'comunion', 'misa-1')])
    expect(generales[0]!.cuantas).toBe(1)
    expect(deMisa[0]!.cuantas).toBe(1)
  })

  test('una lista vacía devuelve una lista vacía, no null', () => {
    expect(rankear([])).toEqual([])
  })

  test('la misma persona no infla el conteo aunque venga repetida', () => {
    // La base lo impide con dos índices parciales; el motor no puede confiar en
    // que la fila que le llega sea la única.
    const r = rankear([s('alma', 'ana'), s('alma', 'ana')])
    expect(r[0]!.cuantas).toBe(1)
    expect(r[0]!.quienes).toEqual(['ana'])
  })
})

describe('yaSugirio', () => {
  const mias = [s('alma', 'ana', 'comunion', null), s('pescador', 'ana', 'comunion', 'misa-1')]

  test('reconoce la propuesta general propia', () => {
    expect(yaSugirio(mias, 'alma', 'comunion', null)).toBe(true)
  })

  test('reconoce la propuesta de misa propia', () => {
    expect(yaSugirio(mias, 'pescador', 'comunion', 'misa-1')).toBe(true)
  })

  test('la general y la de misa son distintas: proponer una no es proponer la otra', () => {
    // Es la consecuencia directa de haber pedido las dos cosas. El control tiene
    // que poder decir «ya la propusiste en general, pero no para este domingo».
    expect(yaSugirio(mias, 'alma', 'comunion', 'misa-1')).toBe(false)
    expect(yaSugirio(mias, 'pescador', 'comunion', null)).toBe(false)
  })

  test('otro momento es otra propuesta', () => {
    expect(yaSugirio(mias, 'alma', 'ofertorio', null)).toBe(false)
  })
})
