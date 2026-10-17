import { describe, expect, test } from 'vitest'
import { TASA_MAX, TASA_MIN, bpmDeTasa, esBpmDeExportacion, tasaDeTempo, temposDe } from './tempo'

/**
 * El tempo del reproductor (PRD §21.6).
 *
 * Las pistas están generadas al tempo de la partitura. Escuchar más lento es
 * reproducirlas a otra tasa conservando la afinación, no regenerarlas: eso es
 * solo para exportar (§21.10).
 */
describe('tasaDeTempo', () => {
  test('♩ 56 sobre una partitura a 62 → 0,9032', () => {
    expect(tasaDeTempo(56, 62)).toBeCloseTo(0.9032, 4)
  })

  test('el tempo original → 1', () => {
    expect(tasaDeTempo(62, 62)).toBe(1)
  })

  test('se topa en 0,5–1,5, el ajuste fino de 50–150 %', () => {
    expect([TASA_MIN, TASA_MAX]).toEqual([0.5, 1.5])
    expect(tasaDeTempo(20, 62)).toBe(0.5)
    expect(tasaDeTempo(200, 62)).toBe(1.5)
  })

  test('una partitura sin tempo válido no rompe: tasa 1', () => {
    expect(tasaDeTempo(56, 0)).toBe(1)
  })
})

describe('bpmDeTasa', () => {
  test('es la inversa, redondeada a entero', () => {
    expect(bpmDeTasa(0.9032, 62)).toBe(56)
    expect(bpmDeTasa(1, 62)).toBe(62)
  })
})

describe('temposDe — los tres botones', () => {
  test('a ♩ 62 son Lento 48, Ensayo 56 y Original 62, como en escuchar.html', () => {
    expect(temposDe(62)).toEqual([
      { nombre: 'Lento', bpm: 48 },
      { nombre: 'Ensayo', bpm: 56 },
      { nombre: 'Original', bpm: 62 },
    ])
  })

  test('en otra partitura guardan la misma proporción', () => {
    expect(temposDe(93).map((t) => t.bpm)).toEqual([72, 84, 93])
  })
})

describe('esBpmDeExportacion — los límites de motor/pedidos.py', () => {
  test('entero entre 20 y 240', () => {
    expect(esBpmDeExportacion(20)).toBe(true)
    expect(esBpmDeExportacion(240)).toBe(true)
    expect(esBpmDeExportacion(56)).toBe(true)
    expect(esBpmDeExportacion(19)).toBe(false)
    expect(esBpmDeExportacion(241)).toBe(false)
    expect(esBpmDeExportacion(56.5)).toBe(false)
    expect(esBpmDeExportacion('56')).toBe(false)
  })
})
