import { describe, expect, test } from 'vitest'
import { avanceDeLaMisa, vocesQueVan } from './tablero'
import type { Inscrito } from './inscripcion'

/**
 * El Inicio como tablero (el dueño, 2026-10-17, opción B: «¿qué tan lista
 * está la misa?»). Todo se calcula al leer; nada de esto se guarda.
 */

const conTono = (n: number, sin: number) => [
  ...Array.from({ length: n }, () => ({ tonoDeMisa: 0 })),
  ...Array.from({ length: sin }, () => ({ tonoDeMisa: null })),
]

describe('avanceDeLaMisa', () => {
  test('lista del todo: cantos, todos con tono, alguien toca y respondió todo el coro', () => {
    const a = avanceDeLaMisa({ cantos: conTono(9, 0), tocan: 2, coro: 10, sinResponder: 0 })
    expect(a.porcentaje).toBe(100)
    expect(a).toMatchObject({ cantos: 9, conTono: 9, tocan: 2, sinResponder: 0 })
  })

  test('es el promedio de las cuatro partes', () => {
    // cantos 1 · tonos 8/9 · músicos 0 · respuestas 5/10 → (1 + 0,889 + 0 + 0,5) / 4 = 59,7
    const a = avanceDeLaMisa({ cantos: conTono(8, 1), tocan: 0, coro: 10, sinResponder: 5 })
    expect(a.porcentaje).toBe(60)
  })

  test('sin cantos no hay tonos que fijar: las dos partes valen cero', () => {
    const a = avanceDeLaMisa({ cantos: [], tocan: 1, coro: 4, sinResponder: 0 })
    expect(a.porcentaje).toBe(50)
    expect(a.conTono).toBe(0)
  })

  test('un tono 0 fijado cuenta como fijado: fijar el original también es decidir', () => {
    expect(avanceDeLaMisa({ cantos: [{ tonoDeMisa: 0 }], tocan: 1, coro: 1, sinResponder: 0 }).porcentaje).toBe(100)
  })

  test('un coro sin miembros no resta por respuestas', () => {
    expect(avanceDeLaMisa({ cantos: conTono(1, 0), tocan: 1, coro: 0, sinResponder: 0 }).porcentaje).toBe(100)
  })
})

describe('vocesQueVan', () => {
  const ins = (perfilId: string, aporte: Inscrito['aporte'] = 'vocal'): Inscrito => ({
    perfilId,
    nombre: null,
    aporte,
    instrumento: aporte === 'instrumental' ? 'guitarra' : null,
  })

  test('cuenta por cuerda a quienes van a cantar, según su tesitura', () => {
    const v = vocesQueVan(
      [ins('a'), ins('b'), ins('c'), ins('d')],
      [
        { perfilId: 'a', tesitura: 'soprano' },
        { perfilId: 'b', tesitura: 'mezzosoprano' },
        { perfilId: 'c', tesitura: 'baritono' },
        { perfilId: 'd', tesitura: 'tenor' },
      ]
    )
    // Mezzo cuenta como contralto y barítono como bajo, igual que en Ensayar.
    expect(v).toEqual({ soprano: 1, contralto: 1, tenor: 1, bajo: 1, sinCuerda: 0, total: 4 })
  })

  test('quien no cargó su tesitura va como «sin cuerda», para que el total cuadre', () => {
    const v = vocesQueVan([ins('a'), ins('x')], [{ perfilId: 'a', tesitura: 'bajo' }])
    expect(v).toMatchObject({ bajo: 1, sinCuerda: 1, total: 2 })
  })

  test('los que van a tocar no son voces', () => {
    const v = vocesQueVan([ins('a', 'instrumental')], [{ perfilId: 'a', tesitura: 'tenor' }])
    expect(v.total).toBe(0)
  })
})
