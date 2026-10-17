import { describe, expect, test } from 'vitest'
import { alternarHerramienta, esHerramienta, normalizarHerramientas } from './herramientas'

describe('herramientas', () => {
  test('solo las que existen', () => {
    expect(esHerramienta('quien_canta')).toBe(true)
    expect(esHerramienta('borrar_todo')).toBe(false)
  })

  test('lo guardado se limpia: sin desconocidas ni repetidas; basura es ninguna', () => {
    expect(normalizarHerramientas(['quien_canta', 'x', 'quien_canta', 'dar_tono'])).toEqual([
      'quien_canta',
      'dar_tono',
    ])
    expect(normalizarHerramientas(null)).toEqual([])
    expect(normalizarHerramientas('quien_canta')).toEqual([])
  })

  test('prender y apagar una no toca las otras', () => {
    expect(alternarHerramienta(['dar_tono'], 'quien_canta', true)).toEqual(['dar_tono', 'quien_canta'])
    expect(alternarHerramienta(['dar_tono', 'quien_canta'], 'dar_tono', false)).toEqual(['quien_canta'])
    expect(alternarHerramienta(['dar_tono'], 'dar_tono', true)).toEqual(['dar_tono'])
  })
})
