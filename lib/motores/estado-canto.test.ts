import { describe, expect, test } from 'vitest'
import {
  ESTADOS,
  ESTADOS_EDITABLES,
  contarEnEnsayo,
  esEstadoValido,
  estaArchivado,
  etiquetaEstado,
  normalizarEstado,
  type EstadoCanto,
} from './estado-canto'

/**
 * H10 · Estado del canto — el "listo cuando" de §17.
 *
 * Dos estados desde el 2026-08-07 —`en_ensayo` y `listo`— y un tercero desde el
 * 2026-09-03: `archivado`, que es la respuesta al borrado que §16 había dejado
 * sin decidir. Un canto no se borra: sale de circulación, y se puede traer de
 * vuelta.
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
  test('acepta los tres estados del dominio', () => {
    expect(esEstadoValido('en_ensayo')).toBe(true)
    expect(esEstadoValido('listo')).toBe(true)
    expect(esEstadoValido('archivado')).toBe(true)
  })

  test('cierra hacia el NO ante cualquier otra cosa', () => {
    for (const basura of ['LISTO', 'en ensayo', '', 'sugerido']) {
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

  test('un canto archivado se dice, porque solo se ve donde hay que decirlo', () => {
    // Fuera del repertorio no aparece. Pero en la vista de archivados y en la
    // misa pasada donde se cantó, sí — y ahí la marca es la que explica por
    // qué ese canto no está en el listado.
    expect(etiquetaEstado('archivado')).toBe('Archivado')
  })

  test('los tres estados están cubiertos, sin celdas ambiguas', () => {
    for (const e of ESTADOS) {
      expect(etiquetaEstado(e)).not.toBe(undefined)
    }
  })
})

describe('ESTADOS_EDITABLES', () => {
  test('el formulario alterna dos estados, no tres', () => {
    // `archivado` NO se elige desde el mismo selector que `en_ensayo`: sacar un
    // canto del repertorio pasa por su propia confirmación, que dice en cuántas
    // misas aparece. Si estuviera acá, un toque de más lo archivaría sin que
    // nadie se enterara.
    expect([...ESTADOS_EDITABLES]).toEqual(['en_ensayo', 'listo'])
  })

  test('todo lo editable es un estado válido: no se puede ofrecer lo que la base rechaza', () => {
    for (const e of ESTADOS_EDITABLES) {
      expect(esEstadoValido(e)).toBe(true)
    }
  })

  test('archivado queda fuera de lo editable pero dentro del dominio', () => {
    expect((ESTADOS_EDITABLES as readonly string[]).includes('archivado')).toBe(false)
    expect((ESTADOS as readonly string[]).includes('archivado')).toBe(true)
  })
})

describe('estaArchivado', () => {
  test('solo `archivado` está archivado', () => {
    expect(estaArchivado('archivado')).toBe(true)
    expect(estaArchivado('listo')).toBe(false)
    expect(estaArchivado('en_ensayo')).toBe(false)
  })

  test('un canto en ensayo NO está archivado: son cosas distintas', () => {
    // El que se está sacando sigue en el repertorio, marcado. El archivado
    // salió de circulación. Confundirlos escondería del listado justo los
    // cantos que el coro está aprendiendo.
    expect(estaArchivado('en_ensayo')).toBe(false)
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
