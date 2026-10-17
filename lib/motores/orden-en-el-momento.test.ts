import { describe, expect, test } from 'vitest'
import { moverEnLista, ordenarMomento } from './orden-en-el-momento'

/**
 * El orden de los cantos dentro de un momento (pedido del dueño, 2026-10-17):
 * el director los sube y los baja; lo que nunca se ordenó va al final, por título.
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

describe('moverEnLista', () => {
  const ids = ['a', 'b', 'c']

  test('sube y baja un lugar', () => {
    expect(moverEnLista(ids, 'b', 'arriba')).toEqual(['b', 'a', 'c'])
    expect(moverEnLista(ids, 'b', 'abajo')).toEqual(['a', 'c', 'b'])
  })

  test('en los bordes no se mueve', () => {
    expect(moverEnLista(ids, 'a', 'arriba')).toEqual(ids)
    expect(moverEnLista(ids, 'c', 'abajo')).toEqual(ids)
  })

  test('uno que no está deja la lista igual', () => {
    expect(moverEnLista(ids, 'z', 'arriba')).toEqual(ids)
  })
})
