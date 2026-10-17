import { describe, expect, test } from 'vitest'
import {
  TAMANO_MAX,
  TAMANO_MIN,
  TAMANO_POR_DEFECTO,
  cambiarTamano,
  esTamanoValido,
} from './tamano-letra'

/**
 * El tamaño de letra del cifrado (RN-14, revisada el 2026-10-17).
 *
 * Es de la PERSONA, no del canto, y su tope subió de 24 a 32: en 360 px los 24
 * pedidos quedaban en unos 21 reales, y para quien ve poco eso no alcanzaba.
 */
describe('tamaño de letra', () => {
  test('el rango es 14–32 y el valor por defecto 16', () => {
    expect([TAMANO_MIN, TAMANO_MAX, TAMANO_POR_DEFECTO]).toEqual([14, 32, 16])
  })

  test('cambia de a 2 y se topa en los extremos sin pasarse', () => {
    expect(cambiarTamano(16, +1)).toBe(18)
    expect(cambiarTamano(16, -1)).toBe(14)
    expect(cambiarTamano(32, +1)).toBe(32)
    expect(cambiarTamano(14, -1)).toBe(14)
  })

  test('un valor fuera de la grilla vuelve a ella', () => {
    // Un 24 guardado con la regla vieja sigue siendo válido; un 17 no lo es.
    expect(cambiarTamano(17, +1)).toBe(18)
    expect(cambiarTamano(40, -1)).toBe(32)
  })

  test('valida lo que llega de afuera', () => {
    expect(esTamanoValido(24)).toBe(true)
    expect(esTamanoValido(32)).toBe(true)
    expect(esTamanoValido(34)).toBe(false)
    expect(esTamanoValido(17)).toBe(false)
    expect(esTamanoValido('20')).toBe(false)
  })
})
