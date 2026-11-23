import { describe, expect, test } from 'vitest'
import { nivelDeComplejidad } from './complejidad'

describe('nivelDeComplejidad', () => {
  test('todo listo es baja', () => {
    const r = nivelDeComplejidad([
      { id: 'a', estado: 'listo', veces: 12 },
      { id: 'b', estado: 'listo', veces: 0 },
    ])
    expect(r).toEqual({ nivel: 'baja', enEnsayo: 0, sinCantar: 0 })
  })

  test('en ensayo pero ya cantadas es media', () => {
    const r = nivelDeComplejidad([
      { id: 'a', estado: 'listo', veces: 3 },
      { id: 'b', estado: 'en_ensayo', veces: 4 },
    ])
    expect(r).toEqual({ nivel: 'media', enEnsayo: 1, sinCantar: 0 })
  })

  test('en ensayo sin cantar nunca es alta', () => {
    const r = nivelDeComplejidad([
      { id: 'a', estado: 'en_ensayo', veces: 0 },
      { id: 'b', estado: 'listo', veces: 9 },
    ])
    expect(r).toEqual({ nivel: 'alta', enEnsayo: 1, sinCantar: 1 })
  })

  test('el mismo canto en dos momentos cuenta una vez', () => {
    const r = nivelDeComplejidad([
      { id: 'a', estado: 'en_ensayo', veces: 0 },
      { id: 'a', estado: 'en_ensayo', veces: 0 },
    ])
    expect(r).toEqual({ nivel: 'alta', enEnsayo: 1, sinCantar: 1 })
  })

  test('sin cantos es baja', () => {
    expect(nivelDeComplejidad([])).toEqual({ nivel: 'baja', enEnsayo: 0, sinCantar: 0 })
  })
})
