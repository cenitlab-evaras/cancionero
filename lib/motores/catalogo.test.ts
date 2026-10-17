import { describe, expect, test } from 'vitest'
import { claveDeTitulo, filtrarCatalogo, repetidas, type CancionDeCatalogo } from './catalogo'

/**
 * «Canciones» (pedido del dueño, 2026-10-17): todas las canciones del coro una
 * sola vez —en el repertorio cada una sale en cada momento donde está, y así no
 * se puede contar—, con las repetidas marcadas y una tabla para filtrar.
 */

const cancion = (c: Partial<CancionDeCatalogo> & { id: string; titulo: string }): CancionDeCatalogo => ({
  autor: null,
  tonalidadOriginal: null,
  estado: 'listo',
  momentos: [],
  conPartitura: false,
  conSolistas: false,
  ...c,
})

describe('claveDeTitulo — cuándo dos títulos son la misma canción', () => {
  test('sin tildes, mayúsculas, signos ni espacios de más', () => {
    expect(claveDeTitulo('¡Cantaré por siempre!')).toBe(claveDeTitulo('cantare  por siempre'))
    expect(claveDeTitulo('Salmo 23 (El Señor es mi Pastor)')).toBe(claveDeTitulo('salmo 23 el señor es mi pastor'))
  })

  test('la ñ no es una n', () => {
    expect(claveDeTitulo('Señor')).not.toBe(claveDeTitulo('Senor'))
  })
})

describe('repetidas', () => {
  test('cuenta cuántas veces está cada canción, solo las que están más de una vez', () => {
    const r = repetidas([
      cancion({ id: '1', titulo: 'Abre tu jardín' }),
      cancion({ id: '2', titulo: 'Abre tu Jardin' }),
      cancion({ id: '3', titulo: 'Escojo la vida' }),
    ])
    expect(r.get('1')).toBe(2)
    expect(r.get('2')).toBe(2)
    expect(r.has('3')).toBe(false)
  })
})

describe('filtrarCatalogo', () => {
  const todas = [
    cancion({ id: '1', titulo: 'Abre tu jardín', autor: 'Fones', momentos: ['entrada'], conPartitura: true }),
    cancion({ id: '2', titulo: 'Abre tu jardin', momentos: ['entrada', 'salida'] }),
    cancion({ id: '3', titulo: 'Escojo la vida', estado: 'en_ensayo', momentos: ['comunion'] }),
  ]
  const r = repetidas(todas)

  test('sin filtros, todas', () => {
    expect(filtrarCatalogo(todas, {}, r).map((c) => c.id)).toEqual(['1', '2', '3'])
  })

  test('por texto en título o autor, sin tildes', () => {
    expect(filtrarCatalogo(todas, { texto: 'JARDIN' }, r).map((c) => c.id)).toEqual(['1', '2'])
    expect(filtrarCatalogo(todas, { texto: 'fones' }, r).map((c) => c.id)).toEqual(['1'])
  })

  test('por momento, estado y partitura', () => {
    expect(filtrarCatalogo(todas, { momento: 'salida' }, r).map((c) => c.id)).toEqual(['2'])
    expect(filtrarCatalogo(todas, { estado: 'en_ensayo' }, r).map((c) => c.id)).toEqual(['3'])
    expect(filtrarCatalogo(todas, { partitura: 'con' }, r).map((c) => c.id)).toEqual(['1'])
    expect(filtrarCatalogo(todas, { partitura: 'sin' }, r).map((c) => c.id)).toEqual(['2', '3'])
  })

  test('solo las que tienen estrofas de solista', () => {
    const conSolista = [...todas, cancion({ id: '4', titulo: 'Cantaré por siempre', conSolistas: true })]
    expect(filtrarCatalogo(conSolista, { soloConSolistas: true }, r).map((c) => c.id)).toEqual(['4'])
  })

  test('solo las repetidas', () => {
    expect(filtrarCatalogo(todas, { soloRepetidas: true }, r).map((c) => c.id)).toEqual(['1', '2'])
  })

  test('los filtros se combinan', () => {
    expect(filtrarCatalogo(todas, { soloRepetidas: true, momento: 'salida' }, r).map((c) => c.id)).toEqual(['2'])
  })
})
