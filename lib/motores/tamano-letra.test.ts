import { describe, expect, test } from 'vitest'
import {
  PIXELES,
  TAMANOS,
  TAMANO_POR_DEFECTO,
  cambiarTamano,
  esTamanoValido,
  presetDePixeles,
  siguienteTamano,
} from './tamano-letra'

/**
 * El tamaño de letra del cifrado (RN-14, revisada el 2026-11-23).
 *
 * Tres presets reales —Pequeño 18 px, Regular 22 px, Grande 28 px— en vez de
 * una grilla de 14 a 32 de a 2. Es de la PERSONA, no del canto: quien ve poco
 * lo elige una vez y vale en todo el repertorio y en toda la misa.
 */
describe('tamaño de letra', () => {
  test('los presets son Pequeño 18, Regular 22 y Grande 28', () => {
    expect([PIXELES.pequeno, PIXELES.regular, PIXELES.grande]).toEqual([18, 22, 28])
    expect(TAMANOS).toEqual(['pequeno', 'regular', 'grande'])
    expect(TAMANO_POR_DEFECTO).toBe('regular')
  })

  test('valida lo que llega de afuera: solo los tres píxeles de los presets', () => {
    expect(esTamanoValido(18)).toBe(true)
    expect(esTamanoValido(20)).toBe(false)
  })

  test('normaliza un píxel viejo al preset más cercano', () => {
    expect(presetDePixeles(14)).toBe('pequeno')
    expect(presetDePixeles(24)).toBe('regular')
    expect(presetDePixeles(32)).toBe('grande')
  })

  test('un paso más grande o más chico, sin salirse de la lista', () => {
    expect(siguienteTamano('regular', 1)).toBe('grande')
    expect(siguienteTamano('pequeno', -1)).toBe('pequeno')
  })

  test('cambiarTamano devuelve el píxel del preset siguiente y topa en los extremos', () => {
    expect(cambiarTamano('pequeno', 1)).toBe(22)
    // Un valor viejo (16 px) se normaliza antes de moverse.
    expect(cambiarTamano(16, 1)).toBe(22)
    expect(cambiarTamano(22, -1)).toBe(18)
    expect(cambiarTamano('grande', 1)).toBe(28)
    expect(cambiarTamano('pequeno', -1)).toBe(18)
  })
})
