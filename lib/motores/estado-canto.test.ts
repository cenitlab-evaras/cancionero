import { describe, expect, test } from 'vitest'
import {
  ESTADOS,
  contarEnEnsayo,
  esEstadoValido,
  etiquetaEstado,
  normalizarEstado,
  type EstadoCanto,
} from './estado-canto'

/**
 * H10 · Estado del canto — el "listo cuando" de §17.
 *
 * Dos estados, decididos por el dueño el 2026-08-07: `en_ensayo` y `listo`.
 * `archivado` NO entra; §17 declara que por eso el borrado de §16 sigue abierto.
 *
 * Lo que este motor tiene que garantizar, y por qué cada cosa está acá y no
 * suelta en una pantalla:
 *
 *  1. Un valor desconocido nunca se trata como estado (la entrada del formulario
 *     llega por POST y no es confiable).
 *  2. La etiqueta se escribe UNA vez: listado, vista de lectura y formulario
 *     tienen que decir exactamente lo mismo.
 *  3. El conteo cuenta CANTOS, no apariciones: el listado agrupa por momento y
 *     un canto en tres momentos aparece tres veces. Ese es el bug que este
 *     motor existe para no cometer.
 */

describe('esEstadoValido', () => {
  test('acepta los dos estados del dominio', () => {
    expect(esEstadoValido('en_ensayo')).toBe(true)
    expect(esEstadoValido('listo')).toBe(true)
  })

  test('cierra hacia el NO ante cualquier otra cosa', () => {
    // `archivado` está acá a propósito: es el que §17 dejó fuera. El día que
    // entre, este test se pone rojo solo y obliga a mirar la migración.
    for (const basura of ['archivado', 'LISTO', 'en ensayo', '', 'sugerido']) {
      expect(esEstadoValido(basura)).toBe(false)
    }
  })
})

describe('normalizarEstado', () => {
  test('deja pasar un estado válido', () => {
    expect(normalizarEstado('en_ensayo')).toBe('en_ensayo')
    expect(normalizarEstado('listo')).toBe('listo')
  })

  test('un valor desconocido o ausente cae en `listo`, igual que el default de la columna', () => {
    // Coherencia con la migración: la columna es `not null default 'listo'`.
    // Si acá cayera en `en_ensayo`, un canto viejo aparecería marcado como que
    // el coro no lo sabe cantar, que es peor que no marcar nada.
    expect(normalizarEstado(null)).toBe('listo')
    expect(normalizarEstado(undefined)).toBe('listo')
    expect(normalizarEstado('cualquier cosa')).toBe('listo')
  })
})

describe('etiquetaEstado', () => {
  test('cada estado tiene un texto, y `listo` no tiene ninguno', () => {
    // `listo` es el caso normal: marcarlo ensuciaría la lista entera para no
    // decir nada. Solo se marca lo excepcional.
    expect(etiquetaEstado('en_ensayo')).toBe('En ensayo')
    expect(etiquetaEstado('listo')).toBe(null)
  })

  test('los dos estados están cubiertos, sin celdas ambiguas', () => {
    for (const e of ESTADOS) {
      expect(etiquetaEstado(e)).not.toBe(undefined)
    }
  })
})

describe('contarEnEnsayo', () => {
  const canto = (id: string, estado: EstadoCanto) => ({ id, estado })

  test('cuenta los cantos en ensayo', () => {
    expect(
      contarEnEnsayo([
        canto('a', 'en_ensayo'),
        canto('b', 'listo'),
        canto('c', 'en_ensayo'),
      ])
    ).toBe(2)
  })

  test('un canto que aparece en varios momentos se cuenta UNA vez', () => {
    // El listado agrupa por momento y `repertorioPorMomento` empuja el mismo
    // canto a cada grupo que le corresponde. Contar apariciones diría 3.
    expect(
      contarEnEnsayo([
        canto('a', 'en_ensayo'),
        canto('a', 'en_ensayo'),
        canto('a', 'en_ensayo'),
        canto('b', 'listo'),
      ])
    ).toBe(1)
  })

  test('sin cantos en ensayo devuelve 0, no null', () => {
    expect(contarEnEnsayo([canto('a', 'listo')])).toBe(0)
    expect(contarEnEnsayo([])).toBe(0)
  })
})
