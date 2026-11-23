import { describe, expect, test } from 'vitest'
import { ANCHO_CARACTER, columnasPara } from './cifrado-ancho'

describe('columnasPara', () => {
  test('a 328 px con 22 px entran 24 columnas', () => {
    expect(columnasPara(22, 328)).toBe(24)
  })

  test('a 328 px con 28 px entran 19 columnas', () => {
    expect(columnasPara(28, 328)).toBe(19)
  })

  test('las columnas calculadas siempre caben en el ancho', () => {
    for (const [tamano, ancho] of [[18, 328], [22, 328], [28, 328], [22, 296], [28, 296]] as const) {
      const c = columnasPara(tamano, ancho)
      expect(c * tamano * ANCHO_CARACTER).toBeLessThanOrEqual(ancho)
      expect(c).toBeGreaterThanOrEqual(14)
    }
  })

  test('un ancho mínimo no da cero columnas', () => {
    expect(columnasPara(28, 80)).toBe(14)
  })
})
