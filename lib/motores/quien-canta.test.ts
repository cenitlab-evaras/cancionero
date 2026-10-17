import { describe, expect, test } from 'vitest'
import { cuerdasQueCantan, estrofasDe, marcarEstrofa, nombreDeQuienCanta } from './quien-canta'

/**
 * Quién canta cada estrofa (pedido del dueño, 2026-10-17). Se guarda en el
 * cifrado, en la primera línea de la estrofa: `{x_canta: mujeres}`. Así se
 * mueve con el texto cuando el cifrado se edita.
 */

const CIFRADO = ['Intro: [F] [C]', '', '[F]Cantaré por siempre', 'tu bondad', '', '', 'Despertar cada día', 'y arraigarnos'].join('\n')

describe('estrofasDe', () => {
  test('las estrofas son los bloques entre líneas en blanco', () => {
    const e = estrofasDe(CIFRADO)
    expect(e.map((x) => [x.desde, x.hasta])).toEqual([
      [0, 0],
      [2, 3],
      [6, 7],
    ])
    expect(e.every((x) => x.canta === null)).toBe(true)
  })

  test('lee la marca de la primera línea', () => {
    const e = estrofasDe('{x_canta: mujeres}\nla letra\n\n{x_canta:solista}\notra')
    expect(e.map((x) => x.canta)).toEqual(['mujeres', 'solista'])
  })

  test('una marca desconocida no inventa nada', () => {
    expect(estrofasDe('{x_canta: el perro}\nla letra')[0].canta).toBeNull()
  })
})

describe('marcarEstrofa', () => {
  test('agrega la marca arriba de la estrofa', () => {
    const r = marcarEstrofa(CIFRADO, 1, 'mujeres')
    expect(r.split('\n').slice(2, 4)).toEqual(['{x_canta: mujeres}', '[F]Cantaré por siempre'])
    expect(estrofasDe(r).map((x) => x.canta)).toEqual([null, 'mujeres', null])
  })

  test('cambia la que había, sin duplicarla', () => {
    const r = marcarEstrofa(marcarEstrofa(CIFRADO, 2, 'solista'), 2, 'hombres')
    expect(r.match(/x_canta/g)?.length).toBe(1)
    expect(estrofasDe(r)[2].canta).toBe('hombres')
  })

  test('la quita con null y deja el cifrado como estaba', () => {
    expect(marcarEstrofa(marcarEstrofa(CIFRADO, 1, 'todos'), 1, null)).toBe(CIFRADO)
  })

  test('una estrofa que no existe deja todo igual', () => {
    expect(marcarEstrofa(CIFRADO, 9, 'todos')).toBe(CIFRADO)
  })
})

describe('cuerdasQueCantan — para «Resaltar mi cuerda»', () => {
  test('mujeres y hombres son dos cuerdas cada uno; todos, las cuatro', () => {
    expect(cuerdasQueCantan('mujeres')).toEqual(['soprano', 'contralto'])
    expect(cuerdasQueCantan('hombres')).toEqual(['tenor', 'bajo'])
    expect(cuerdasQueCantan('todos')).toEqual(['soprano', 'contralto', 'tenor', 'bajo'])
    expect(cuerdasQueCantan('tenor')).toEqual(['tenor'])
  })

  test('el solista no es ninguna cuerda del coro', () => {
    expect(cuerdasQueCantan('solista')).toEqual([])
  })
})

test('nombreDeQuienCanta', () => {
  expect(nombreDeQuienCanta('mujeres')).toBe('Mujeres')
  expect(nombreDeQuienCanta('contralto')).toBe('Contraltos')
})
