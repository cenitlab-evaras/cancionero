import { describe, expect, test } from 'vitest'
import { ordenDeInsercion, reordenar, recorrido } from './celebracion'

/**
 * H6 · docs/PRD.md §5 y §17.
 *
 * Dos reglas puras sostienen el "listo cuando" del hito:
 *
 *   · el orden de la misa sigue al orden litúrgico, para que el director no
 *     tenga que acomodar a mano lo que la liturgia ya ordenó;
 *   · el recorrido va de un canto al siguiente sin volver al listado, que es
 *     literalmente lo que el músico hace con el teléfono en la mano.
 *
 * `orden` es la posición dentro de la celebración, y NO es el momento: dos
 * cantos pueden compartir momento y su orden los separa (§5).
 */

/** Los momentos de una misa, con el `orden` que tienen en el catálogo. */
const ENTRADA = 1
const PERDON = 2
const OFERTORIO = 6
const SANTO = 7
const COMUNION = 9

describe('ordenDeInsercion', () => {
  test('en una celebración vacía, el primer canto va a la posición 0', () => {
    expect(ordenDeInsercion([], ENTRADA)).toBe(0)
  })

  test('un momento posterior se agrega al final', () => {
    const misa = [
      { orden: 0, momentoOrden: ENTRADA },
      { orden: 1, momentoOrden: PERDON },
    ]
    expect(ordenDeInsercion(misa, COMUNION)).toBe(2)
  })

  test('un momento anterior se INTERCALA donde le toca, no al final', () => {
    // Es la regla que hace que la misa se arme sola: el director agrega el
    // Santo después del Ofertorio y la Entrada sigue primera.
    const misa = [
      { orden: 0, momentoOrden: OFERTORIO },
      { orden: 1, momentoOrden: SANTO },
    ]
    expect(ordenDeInsercion(misa, ENTRADA)).toBe(0)
  })

  test('un momento intermedio cae entre los dos que lo rodean', () => {
    const misa = [
      { orden: 0, momentoOrden: ENTRADA },
      { orden: 1, momentoOrden: COMUNION },
    ]
    expect(ordenDeInsercion(misa, OFERTORIO)).toBe(1)
  })

  test('con el mismo momento, el nuevo va DESPUÉS de los que ya están', () => {
    // Dos cantos de comunión son normales; el que llega segundo se canta
    // segundo. Si fuera antes, agregar cambiaría el orden de lo ya decidido.
    const misa = [
      { orden: 0, momentoOrden: COMUNION },
      { orden: 1, momentoOrden: COMUNION },
    ]
    expect(ordenDeInsercion(misa, COMUNION)).toBe(2)
  })

  test('no depende de que los órdenes guardados sean consecutivos', () => {
    // Después de quitar cantos pueden quedar huecos. La posición se calcula
    // por la POSICIÓN en la lista ordenada, no por el número guardado.
    const misa = [
      { orden: 0, momentoOrden: ENTRADA },
      { orden: 7, momentoOrden: SANTO },
    ]
    expect(ordenDeInsercion(misa, PERDON)).toBe(1)
  })
})

describe('reordenar', () => {
  test('renumera desde 0 y sin huecos, respetando el orden recibido', () => {
    expect(reordenar(['c', 'a', 'b'])).toEqual([
      { id: 'c', orden: 0 },
      { id: 'a', orden: 1 },
      { id: 'b', orden: 2 },
    ])
  })

  test('una lista vacía no rompe', () => {
    expect(reordenar([])).toEqual([])
  })

  test('el resultado nunca tiene dos órdenes iguales', () => {
    // El índice único de la migración lo exige; acá se garantiza antes de
    // llegar a la base, para no descubrirlo con un error de Postgres.
    const ordenes = reordenar(['a', 'b', 'c', 'd']).map((x) => x.orden)
    expect(new Set(ordenes).size).toBe(ordenes.length)
  })
})

describe('recorrido', () => {
  const misa = [
    { id: 'a', orden: 0 },
    { id: 'b', orden: 1 },
    { id: 'c', orden: 2 },
  ]

  test('en el primero no hay anterior, y el siguiente es el segundo', () => {
    expect(recorrido(misa, 'a')).toEqual({
      anterior: null,
      siguiente: 'b',
      posicion: 1,
      total: 3,
    })
  })

  test('en el medio hay los dos', () => {
    expect(recorrido(misa, 'b')).toEqual({
      anterior: 'a',
      siguiente: 'c',
      posicion: 2,
      total: 3,
    })
  })

  test('en el último no hay siguiente: la misa se terminó', () => {
    expect(recorrido(misa, 'c')).toEqual({
      anterior: 'b',
      siguiente: null,
      posicion: 3,
      total: 3,
    })
  })

  test('la posición se cuenta desde 1: es para leerla, no para indexar', () => {
    expect(recorrido(misa, 'a').posicion).toBe(1)
  })

  test('un canto que no está en la celebración no inventa vecinos', () => {
    expect(recorrido(misa, 'zzz')).toEqual({
      anterior: null,
      siguiente: null,
      posicion: 0,
      total: 3,
    })
  })

  test('en una celebración de un solo canto no hay a dónde ir', () => {
    expect(recorrido([{ id: 'unico', orden: 0 }], 'unico')).toEqual({
      anterior: null,
      siguiente: null,
      posicion: 1,
      total: 1,
    })
  })

  test('el recorrido usa el ORDEN guardado, no el orden del array', () => {
    // El "listo cuando" dice "el orden que ve es el que se guardó". Si la
    // consulta devolviera las filas desordenadas, el recorrido tiene que
    // seguir siendo el de la misa.
    const desordenada = [
      { id: 'c', orden: 2 },
      { id: 'a', orden: 0 },
      { id: 'b', orden: 1 },
    ]
    expect(recorrido(desordenada, 'a').siguiente).toBe('b')
    expect(recorrido(desordenada, 'b').siguiente).toBe('c')
    expect(recorrido(desordenada, 'c').siguiente).toBeNull()
  })
})
