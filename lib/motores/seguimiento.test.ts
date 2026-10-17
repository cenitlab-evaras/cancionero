import { describe, expect, test } from 'vitest'
import { activos, notaEn, posicionCursor } from './seguimiento'

/**
 * La partitura que sigue la música (PRD §21.6).
 *
 * Los cinco primeros casos son los de motor/tests/partitura-vivo.test.js, sin
 * cambiar un número: el video exportado y el reproductor mueven el cursor con
 * la misma regla.
 *
 * El tiempo es el de la PARTITURA (`currentTime` en ms), no el del reloj de
 * pared: a ♩ 56 el audio corre más lento, pero `currentTime` sigue midiendo la
 * partitura, así que la nota 10 se pinta en el mismo `currentTime` a 56 y a 62.
 */

// Tres momentos: en 0 ms la partitura está en x=100, en 1000 ms en x=300, en 1500 ms en x=400 (ancho 50)
const CURSOR = [
  { t: 0, x: 100, w: 200 },
  { t: 1000, x: 300, w: 100 },
  { t: 1500, x: 400, w: 50 },
]

describe('posicionCursor — los casos de partitura-vivo.test.js', () => {
  test('antes de empezar, el cursor está en el primer momento', () => {
    expect(posicionCursor(-200, CURSOR)).toBe(100)
  })

  test('justo en un momento, el cursor está en su x', () => {
    expect(posicionCursor(1000, CURSOR)).toBe(300)
  })

  test('entre dos momentos avanza en proporción al tiempo, sin saltar', () => {
    expect(posicionCursor(500, CURSOR)).toBe(200)
    expect(posicionCursor(1250, CURSOR)).toBe(350)
  })

  test('después del último momento avanza por su ancho y se detiene al final', () => {
    expect(posicionCursor(1500, CURSOR, 2000)).toBe(400)
    expect(posicionCursor(1750, CURSOR, 2000)).toBe(425)
    expect(posicionCursor(5000, CURSOR, 2000)).toBe(450)
  })
})

describe('activos — lo que suena en un instante', () => {
  test('devuelve las notas y sílabas que suenan en ese instante', () => {
    const elementos = [
      { id: 'a', t0: 0, t1: 500 },
      { id: 'b', t0: 500, t1: 1000 },
      { id: 'c', t0: 0, t1: 1000 },
    ]
    expect(activos(500, elementos).map((e) => e.id)).toEqual(['b', 'c'])
    expect(activos(1000, elementos).map((e) => e.id)).toEqual([])
  })
})

describe('notaEn — la nota de una cuerda en un instante', () => {
  // Inicios de nota en ms, con un silencio entre la 1 y la 2.
  const NOTAS = [{ t0: 0 }, { t0: 500 }, { t0: 1500 }, { t0: 2000 }]

  test('en el inicio exacto de la nota k devuelve k', () => {
    expect(notaEn(500, NOTAS)).toBe(1)
    expect(notaEn(2000, NOTAS)).toBe(3)
  })

  test('entre dos notas, la anterior', () => {
    expect(notaEn(900, NOTAS)).toBe(1)
  })

  test('antes de la primera, null', () => {
    expect(notaEn(-1, NOTAS)).toBeNull()
    expect(notaEn(0, [])).toBeNull()
  })

  test('después del final, la última', () => {
    expect(notaEn(99_000, NOTAS)).toBe(3)
  })

  test('a ♩ 56 la nota se pinta en el mismo currentTime que a ♩ 62', () => {
    // La tasa no entra: el reproductor le pasa currentTime, que ya está en tiempo de partitura.
    const aOriginal = notaEn(1600, NOTAS)
    const aEnsayo = notaEn(1600, NOTAS)
    expect(aEnsayo).toBe(aOriginal)
  })
})
