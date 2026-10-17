import { describe, expect, test } from 'vitest'
import { cuerdaPorTesitura, esCuerda, nombreDeCuerda, ordenarCuerdas } from './cuerdas'

/**
 * Las cuerdas de una partitura (PRD §21.2) y con cuál abre «Ensayar» (§21.6).
 *
 * La tesitura es de la PERSONA (H14); la cuerda, de lo que está escrito. Seis
 * tesituras y cuatro cuerdas: dos se resuelven por decisión del dueño
 * (§18-23, 2026-10-17): mezzosoprano → contralto y barítono → bajo.
 */
const SATB = ['soprano', 'contralto', 'tenor', 'bajo', 'solista-1']

describe('cuerdaPorTesitura', () => {
  test.each([
    ['soprano', 'soprano'],
    ['mezzosoprano', 'contralto'],
    ['contralto', 'contralto'],
    ['tenor', 'tenor'],
    ['baritono', 'bajo'],
    ['bajo', 'bajo'],
  ] as const)('%s → %s', (tesitura, cuerda) => {
    expect(cuerdaPorTesitura(tesitura, SATB)).toBe(cuerda)
  })

  test('sin tesitura → null (abre con el coro)', () => {
    expect(cuerdaPorTesitura(null, SATB)).toBeNull()
  })

  test('si la partitura no tiene esa cuerda → null', () => {
    expect(cuerdaPorTesitura('tenor', ['soprano', 'contralto'])).toBeNull()
  })
})

describe('nombreDeCuerda', () => {
  test('las del coro con mayúscula y las de solista como estrofas', () => {
    expect(nombreDeCuerda('contralto')).toBe('Contralto')
    expect(nombreDeCuerda('solista-2')).toBe('Estrofa 2')
  })
})

describe('esCuerda', () => {
  test('acepta las cuatro del coro y las estrofas numeradas', () => {
    expect(esCuerda('bajo')).toBe(true)
    expect(esCuerda('solista-12')).toBe(true)
    expect(esCuerda('solista-0')).toBe(false)
    expect(esCuerda('voz')).toBe(false)
  })
})

describe('ordenarCuerdas', () => {
  test('primero el coro de agudo a grave y después las estrofas por número', () => {
    expect(ordenarCuerdas(['solista-10', 'bajo', 'solista-2', 'soprano', 'tenor'])).toEqual([
      'soprano',
      'tenor',
      'bajo',
      'solista-2',
      'solista-10',
    ])
  })
})
