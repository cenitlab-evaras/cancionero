import { describe, expect, test } from 'vitest'
import {
  VELOCIDAD_MAX,
  VELOCIDAD_MIN,
  VELOCIDAD_POR_DEFECTO,
  avanzar,
  pixelesPorSegundo,
} from './autoscroll'

/**
 * H4 · "Tocar sin manos". El listo cuando del PRD §17 pide cuatro cosas:
 * desplazamiento CONTINUO, la velocidad cambia el ritmo SIN SALTOS, la pausa
 * detiene en el punto exacto y al reanudar sigue desde ahí.
 *
 * Las dos primeras se prueban acá, en el motor. Las otras dos son de la
 * pantalla y se verifican corriendo la app.
 */

describe('pixelesPorSegundo', () => {
  test('la velocidad mínima avanza poco pero avanza', () => {
    expect(pixelesPorSegundo(VELOCIDAD_MIN)).toBeGreaterThan(0)
    expect(pixelesPorSegundo(VELOCIDAD_MIN)).toBeLessThan(15)
  })

  test('la velocidad máxima es varias veces la mínima', () => {
    expect(pixelesPorSegundo(VELOCIDAD_MAX)).toBeGreaterThan(pixelesPorSegundo(VELOCIDAD_MIN) * 5)
  })

  test('es monótona: más nivel, más velocidad, sin escalones repetidos', () => {
    for (let n = VELOCIDAD_MIN; n < VELOCIDAD_MAX; n++) {
      expect(pixelesPorSegundo(n + 1)).toBeGreaterThan(pixelesPorSegundo(n))
    }
  })

  test('un nivel fuera de rango se recorta, no revienta', () => {
    expect(pixelesPorSegundo(0)).toBe(pixelesPorSegundo(VELOCIDAD_MIN))
    expect(pixelesPorSegundo(99)).toBe(pixelesPorSegundo(VELOCIDAD_MAX))
  })

  test('la velocidad por defecto está dentro del rango', () => {
    expect(VELOCIDAD_POR_DEFECTO).toBeGreaterThanOrEqual(VELOCIDAD_MIN)
    expect(VELOCIDAD_POR_DEFECTO).toBeLessThanOrEqual(VELOCIDAD_MAX)
  })
})

describe('avanzar — el desplazamiento es continuo, no a saltos', () => {
  test('a 10 px/s, en 100 ms avanza 1 px', () => {
    expect(avanzar(0, 10, 100)).toEqual({ avance: 1, resto: 0 })
  })

  test('las fracciones no se pierden: se acumulan hasta completar un píxel', () => {
    // A 10 px/s, 50 ms son 0,5 px: el primer cuadro no mueve nada…
    const primero = avanzar(0, 10, 50)
    expect(primero.avance).toBe(0)
    expect(primero.resto).toBeCloseTo(0.5)

    // …y el segundo completa el píxel. Sin esto el scroll se ve a tirones.
    const segundo = avanzar(primero.resto, 10, 50)
    expect(segundo.avance).toBe(1)
    expect(segundo.resto).toBeCloseTo(0)
  })

  test('en un segundo de cuadros a 60 fps avanza lo que dice la velocidad', () => {
    let resto = 0
    let total = 0
    for (let i = 0; i < 60; i++) {
      const paso = avanzar(resto, 24, 1000 / 60)
      total += paso.avance
      resto = paso.resto
    }
    expect(total).toBe(24)
  })

  test('un cuadro larguísimo (pestaña en segundo plano) no dispara la página', () => {
    // Sin tope, volver a la pestaña tras 30 s saltaría 720 px de golpe.
    const paso = avanzar(0, 24, 30_000)
    expect(paso.avance).toBeLessThanOrEqual(24)
  })

  test('velocidad cero no mueve nada', () => {
    expect(avanzar(0, 0, 1000)).toEqual({ avance: 0, resto: 0 })
  })
})
