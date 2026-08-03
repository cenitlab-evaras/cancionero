import { describe, expect, test } from 'vitest'
import { coincideBusqueda, normalizarBusqueda } from './busqueda'

// RF-02 del funcional: la búsqueda coincide por título O por autor, sin
// distinguir mayúsculas ni acentos.

describe('normalizarBusqueda', () => {
  test('quita acentos y baja a minúsculas', () => {
    expect(normalizarBusqueda('Abre tu Jardín')).toBe('abre tu jardin')
    expect(normalizarBusqueda('MARÍA')).toBe('maria')
  })

  test('la ñ se conserva: no es un acento, es otra letra', () => {
    expect(normalizarBusqueda('Niño')).toBe('niño')
  })

  test('colapsa espacios de sobra y recorta los de los extremos', () => {
    expect(normalizarBusqueda('  Salmo   23  ')).toBe('salmo 23')
  })

  test('null y vacío devuelven cadena vacía, no revientan', () => {
    expect(normalizarBusqueda(null)).toBe('')
    expect(normalizarBusqueda('')).toBe('')
  })
})

describe('coincideBusqueda', () => {
  const abreTuJardin = { titulo: 'Abre tu jardín', autor: 'Cesáreo Gabaráin' }
  const reinaDelCielo = { titulo: 'Reina del Cielo', autor: 'María Nebreda' }

  test('encuentra por título ignorando el acento', () => {
    expect(coincideBusqueda(abreTuJardin, 'jardin')).toBe(true)
  })

  test('encuentra por autor ignorando mayúsculas y acento', () => {
    expect(coincideBusqueda(reinaDelCielo, 'MARÍA')).toBe(true)
    expect(coincideBusqueda(reinaDelCielo, 'maria')).toBe(true)
  })

  test('un término que no está en ninguno de los dos campos no coincide', () => {
    expect(coincideBusqueda(abreTuJardin, 'xyz')).toBe(false)
  })

  test('un término vacío coincide con todo: no filtra nada', () => {
    expect(coincideBusqueda(abreTuJardin, '')).toBe(true)
    expect(coincideBusqueda(abreTuJardin, '   ')).toBe(true)
  })

  test('un canto sin autor se busca igual por su título', () => {
    expect(coincideBusqueda({ titulo: 'Santo Español', autor: null }, 'santo')).toBe(true)
    expect(coincideBusqueda({ titulo: 'Santo Español', autor: null }, 'gabarain')).toBe(false)
  })

  test('coincide en medio de la palabra, no solo al principio', () => {
    expect(coincideBusqueda(abreTuJardin, 'tu jar')).toBe(true)
  })
})
