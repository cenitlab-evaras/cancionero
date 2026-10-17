import { describe, expect, test } from 'vitest'
import { cambiarTonoDeMisa, esTonoDeMisa, tonalidadDeLaFila, tonoEnLaMisa } from './tono-en-la-misa'

/**
 * H27 · El tono de cada canto en la misa.
 *
 * Dentro de la misa, el tono que fijó el director GANA sobre el personal: es el
 * que va a cantar el cantante, y todos los que tocan tienen que estar en el
 * mismo. Sin fijar, la misa se ve como antes de H27: con el tono de cada uno.
 */
describe('tonoEnLaMisa', () => {
  test('fijado en la misa, gana sobre el tono personal', () => {
    expect(tonoEnLaMisa(1, 5)).toEqual({ semitonos: 1, fijado: true })
  })

  test('fijado en el original (0) también gana: es una decisión, no un vacío', () => {
    expect(tonoEnLaMisa(0, 5)).toEqual({ semitonos: 0, fijado: true })
  })

  test('sin fijar, cada uno ve su tono personal', () => {
    expect(tonoEnLaMisa(null, 5)).toEqual({ semitonos: 5, fijado: false })
  })
})

describe('cambiarTonoDeMisa', () => {
  test('sube y baja de a un semitono', () => {
    expect(cambiarTonoDeMisa(1, 1)).toBe(2)
    expect(cambiarTonoDeMisa(1, -1)).toBe(0)
  })

  test('sin fijar, parte desde el original del cifrado', () => {
    expect(cambiarTonoDeMisa(null, 1)).toBe(1)
    expect(cambiarTonoDeMisa(null, -1)).toBe(-1)
  })

  test('da la vuelta por la octava sin salirse de −11…11', () => {
    expect(cambiarTonoDeMisa(11, 1)).toBe(0)
    expect(cambiarTonoDeMisa(-11, -1)).toBe(0)
  })
})

describe('esTonoDeMisa — lo que acepta la base', () => {
  test('entero entre −11 y 11, o nulo (= sin fijar)', () => {
    expect(esTonoDeMisa(null)).toBe(true)
    expect(esTonoDeMisa(0)).toBe(true)
    expect(esTonoDeMisa(-11)).toBe(true)
    expect(esTonoDeMisa(11)).toBe(true)
    expect(esTonoDeMisa(12)).toBe(false)
    expect(esTonoDeMisa(1.5)).toBe(false)
    expect(esTonoDeMisa('2')).toBe(false)
    expect(esTonoDeMisa(undefined)).toBe(false)
  })
})

describe('tonalidadDeLaFila — lo que se lee al lado del canto en la misa', () => {
  test('fijado: la original transpuesta (E + 1 → F)', () => {
    expect(tonalidadDeLaFila('E', 1)).toBe('F')
  })

  test('sin fijar: la original', () => {
    expect(tonalidadDeLaFila('E', null)).toBe('E')
  })

  test('sin tonalidad original declarada no hay nombre que dar', () => {
    expect(tonalidadDeLaFila(null, 2)).toBeNull()
  })
})
