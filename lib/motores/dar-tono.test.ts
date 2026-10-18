import { describe, expect, test } from 'vitest'
import { notasDelTono } from './dar-tono'

/**
 * Herramienta «Dar el tono» (2026-10-17): un botón que toca la nota del tono y
 * después su acorde, para que el coro arranque afinado. El motor solo dice QUÉ
 * frecuencias suenan; el navegador las toca.
 */

const redondear = (xs: number[]) => xs.map((x) => Math.round(x * 100) / 100)

describe('notasDelTono', () => {
  test('La mayor: la nota es el La 440 y el acorde La–Do#–Mi–La', () => {
    const t = notasDelTono('A')!
    expect(redondear([t.nota])).toEqual([440])
    expect(redondear(t.acorde)).toEqual([220, 277.18, 329.63, 440])
  })

  test('un tono menor lleva tercera menor', () => {
    const t = notasDelTono('Em')!
    expect(redondear([t.nota])).toEqual([329.63])
    expect(redondear(t.acorde)).toEqual([164.81, 196, 246.94, 329.63])
  })

  test('la nota cae siempre en la octava central (Do4 a Si4), cómoda para cantar', () => {
    expect(Math.round(notasDelTono('C')!.nota)).toBe(262)
    expect(Math.round(notasDelTono('B')!.nota)).toBe(494)
  })

  test('acepta bemoles, séptimas y bajo: suena la tríada de la tónica', () => {
    expect(redondear([notasDelTono('Bb')!.nota])).toEqual([466.16])
    expect(notasDelTono('G7')).toEqual(notasDelTono('G'))
    expect(notasDelTono('Gmaj7')).toEqual(notasDelTono('G'))
    expect(notasDelTono('D/F#')).toEqual(notasDelTono('D'))
    expect(notasDelTono('F#m7')).toEqual(notasDelTono('F#m'))
  })

  test('lo que no es un tono no suena', () => {
    expect(notasDelTono('')).toBeNull()
    expect(notasDelTono('H')).toBeNull()
    expect(notasDelTono('N.C.')).toBeNull()
  })
})
