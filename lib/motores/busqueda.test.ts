import { describe, expect, test } from 'vitest'
import { coincideBusqueda, coincideOpcion, normalizarBusqueda } from './busqueda'

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

describe('coincideBusqueda — por el número del cancionero (2026-10-17)', () => {
  // El coro busca de memoria por el número del libro: «el 34».
  const alfarero = { titulo: 'El Alfarero', autor: null, numero: 34 }

  test('un término que es solo un número encuentra el canto con ese número', () => {
    expect(coincideBusqueda(alfarero, '34')).toBe(true)
    expect(coincideBusqueda(alfarero, ' 34 ')).toBe(true)
  })

  test('el número es exacto: 3 no encuentra el 34', () => {
    expect(coincideBusqueda(alfarero, '3')).toBe(false)
  })

  test('un canto sin número se sigue buscando por título', () => {
    expect(coincideBusqueda({ titulo: 'Himno 2025', numero: null }, '2025')).toBe(true)
  })
})

// La lupa de una sección busca en lo que esa sección ofrece, no canciones
// (el dueño, 2026-10-17: en «Más» se busca una herramienta).
describe('coincideOpcion', () => {
  const herramientas = {
    texto: 'Herramientas',
    detalle: 'Quién canta cada estrofa, tu cuerda, dar el tono',
    claves: ['cargar un canto nuevo'],
  }

  test('encuentra por el nombre, sin acentos ni mayúsculas', () => {
    expect(coincideOpcion(herramientas, 'HERRAMIENTA')).toBe(true)
  })

  test('encuentra por el detalle', () => {
    expect(coincideOpcion(herramientas, 'quien canta')).toBe(true)
  })

  test('encuentra por una clave que no se muestra', () => {
    expect(coincideOpcion(herramientas, 'canto nuevo')).toBe(true)
  })

  test('cada palabra puede estar en un lugar distinto', () => {
    expect(coincideOpcion(herramientas, 'tono nuevo')).toBe(true)
  })

  test('no encuentra lo que no dice', () => {
    expect(coincideOpcion(herramientas, 'miembros')).toBe(false)
  })

  test('sin detalle ni claves busca solo en el nombre', () => {
    expect(coincideOpcion({ texto: 'Miembros' }, 'miem')).toBe(true)
  })

  test('un término vacío coincide con todo', () => {
    expect(coincideOpcion({ texto: 'Miembros' }, '  ')).toBe(true)
  })
})
