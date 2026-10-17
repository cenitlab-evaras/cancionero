import { describe, expect, test } from 'vitest'
import { ordenarMomento, soltarCanto } from './orden-en-el-momento'

/**
 * El orden de los cantos dentro de un momento (pedido del dueño, 2026-10-17):
 * el director los arrastra; lo que nunca se ordenó va al final, por título.
 */

describe('ordenarMomento', () => {
  test('primero los ordenados por su lugar; después el resto por título', () => {
    const r = ordenarMomento([
      { id: 'a', titulo: 'Zaqueo', orden: null },
      { id: 'b', titulo: 'Bendito', orden: 1 },
      { id: 'c', titulo: 'Ábreme', orden: null },
      { id: 'd', titulo: 'Señor', orden: 0 },
    ])
    expect(r.map((c) => c.id)).toEqual(['d', 'b', 'c', 'a'])
  })

  test('sin ningún orden es el alfabético de siempre, con tildes bien ordenadas', () => {
    const r = ordenarMomento([
      { id: '1', titulo: 'Escojo la vida', orden: null },
      { id: '2', titulo: 'Abre tu jardín', orden: null },
      { id: '3', titulo: 'Ávido', orden: null },
    ])
    expect(r.map((c) => c.id)).toEqual(['2', '3', '1'])
  })
})

// El director arrastra un canto con el dedo o el mouse (el dueño, 2026-10-17:
// «el clásico mover con el dedo»), dentro de su momento o a otro.
describe('soltarCanto', () => {
  test('dentro del mismo momento lo deja en el lugar donde se suelta', () => {
    const r = soltarCanto({ E: ['a', 'b', 'c'] }, { id: 'a', de: 'E', a: 'E', indice: 2 })
    expect(r.E).toEqual(['b', 'c', 'a'])
  })

  test('a otro momento: sale del primero y entra al segundo en ese lugar', () => {
    const r = soltarCanto({ E: ['a', 'b'], C: ['x', 'y'] }, { id: 'b', de: 'E', a: 'C', indice: 1 })
    expect(r).toEqual({ E: ['a'], C: ['x', 'b', 'y'] })
  })

  test('si ya estaba en el destino queda una sola vez, donde se soltó', () => {
    const r = soltarCanto({ E: ['a', 'b'], C: ['b', 'x'] }, { id: 'b', de: 'E', a: 'C', indice: 2 })
    expect(r).toEqual({ E: ['a'], C: ['x', 'b'] })
  })

  test('un lugar fuera de la lista se lleva al borde', () => {
    expect(soltarCanto({ E: ['a', 'b'] }, { id: 'b', de: 'E', a: 'E', indice: -3 }).E).toEqual(['b', 'a'])
    expect(soltarCanto({ E: ['a', 'b'] }, { id: 'a', de: 'E', a: 'E', indice: 9 }).E).toEqual(['b', 'a'])
  })

  test('un canto que no está en el origen, o un momento que no existe, no cambia nada', () => {
    const listas = { E: ['a'], C: ['x'] }
    expect(soltarCanto(listas, { id: 'z', de: 'E', a: 'C', indice: 0 })).toEqual(listas)
    expect(soltarCanto(listas, { id: 'a', de: 'E', a: 'Q', indice: 0 })).toEqual(listas)
  })

  test('no toca las listas que recibe', () => {
    const listas = { E: ['a', 'b'], C: ['x'] }
    soltarCanto(listas, { id: 'a', de: 'E', a: 'C', indice: 0 })
    expect(listas).toEqual({ E: ['a', 'b'], C: ['x'] })
  })
})
