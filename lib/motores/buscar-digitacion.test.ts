import { describe, expect, test } from 'vitest'
import { buscarDigitacion } from './buscar-digitacion'
import { DIGITACIONES, type Catalogo } from './digitaciones'

/**
 * H5 · docs/PRD.md §9 y §15 paso 2.
 *
 * Los dos invariantes que el PRD nombra con todas las letras —`C` → `x32010` y
 * `H9` → `null` sin lanzar— están afirmados abajo con esos literales.
 */

describe('buscarDigitacion', () => {
  test('INVARIANTE §9 · C devuelve x32010', () => {
    const d = buscarDigitacion('C', DIGITACIONES)!
    expect(d.cuerdas).toBe('x32010')
    expect(d.trastes).toEqual([null, 3, 2, 0, 1, 0])
    expect(d.trasteInicial).toBe(1)
  })

  test('INVARIANTE §9 · un acorde inexistente devuelve null y NO lanza', () => {
    expect(() => buscarDigitacion('H9', DIGITACIONES)).not.toThrow()
    expect(buscarDigitacion('H9', DIGITACIONES)).toBeNull()
  })

  test('la cuerda muda es null, no cero: son cosas distintas', () => {
    // `0` se dibuja como un círculo (al aire); `null`, como una x (no suena).
    // Confundirlos hace sonar una cuerda que no va.
    const d = buscarDigitacion('C', DIGITACIONES)!
    expect(d.trastes[0]).toBeNull()
    expect(d.trastes[3]).toBe(0)
  })

  test('la entrada vacía o basura devuelve null sin lanzar', () => {
    for (const basura of ['', '   ', '[C]', '???']) {
      expect(() => buscarDigitacion(basura, DIGITACIONES)).not.toThrow()
      expect(buscarDigitacion(basura, DIGITACIONES)).toBeNull()
    }
  })

  test('un bemol de entrada resuelve a la misma digitación que su sostenido', () => {
    // El catálogo está en sostenidos porque `transponer` emite sostenidos, pero
    // un cifrado sin transponer puede traer `Bb` escrito a mano.
    expect(buscarDigitacion('Bb', DIGITACIONES)?.cuerdas).toBe(
      buscarDigitacion('A#', DIGITACIONES)?.cuerdas
    )
  })

  test('los acordes con bajo devuelven null (decisión declarada)', () => {
    // No caen al acorde base a propósito: `G/B` funcionaría en 0 y `A/C#`
    // fallaría en +2, o sea que el comportamiento cambiaría al transponer.
    // `null` es estable, y §14 ya tiene su mensaje escrito.
    for (const conBajo of ['G/B', 'A9/C#', 'Bm/A', 'D/F#']) {
      expect(buscarDigitacion(conBajo, DIGITACIONES)).toBeNull()
    }
  })

  test('un acorde con cejilla la declara, con su traste y sus cuerdas', () => {
    const f = buscarDigitacion('F', DIGITACIONES)!
    expect(f.cejilla).toEqual({ traste: 1, desde: 0, hasta: 5 })

    // F#m lleva cejilla en el 2 pero se dibuja DESDE LA CEJUELA: cabe entero en
    // la ventana de cinco trastes, y así lo imprime cualquier cancionero. El
    // traste de la cejilla y el inicio del diagrama son cosas distintas.
    const fsm = buscarDigitacion('F#m', DIGITACIONES)!
    expect(fsm.cuerdas).toBe('244222')
    expect(fsm.cejilla).toEqual({ traste: 2, desde: 0, hasta: 5 })
    expect(fsm.trasteInicial).toBe(1)
  })

  test('un acorde alto sí desplaza la ventana y muestra su número de traste', () => {
    // G#m (466444) no llega a la cejuela: el diagrama arranca en el 4. Es uno
    // de los seis acordes de *Abre tu jardín*, o sea que el caso se ve en la
    // pantalla de la verificación, no en un test de laboratorio.
    const gsm = buscarDigitacion('G#m', DIGITACIONES)!
    expect(gsm.cuerdas).toBe('466444')
    expect(gsm.trasteInicial).toBe(4)
  })

  test('un acorde sin cejilla la deja en null, no en undefined', () => {
    expect(buscarDigitacion('C', DIGITACIONES)!.cejilla).toBeNull()
  })

  test('el catálogo es del llamador: el motor no trae el dato adentro', () => {
    const falso: Catalogo = { Zz: { cuerdas: '000000' } }
    expect(buscarDigitacion('Zz', falso)?.cuerdas).toBe('000000')
    expect(buscarDigitacion('C', falso)).toBeNull()
  })

  describe('trasteInicial · la ventana que dibuja el diagrama', () => {
    const catalogo: Catalogo = {
      Alto: { cuerdas: '688886' },
      Medio: { cuerdas: 'x35553' },
      Abierto: { cuerdas: '022100' },
      Bajo: { cuerdas: 'x24442' },
    }

    test('arranca en 1 cuando hay cuerdas al aire', () => {
      expect(buscarDigitacion('Abierto', catalogo)!.trasteInicial).toBe(1)
    })

    test('arranca en 1 si todo cabe en los cinco primeros trastes', () => {
      // Sin cuerdas al aire, pero la cejuela sigue siendo la referencia útil.
      expect(buscarDigitacion('Bajo', catalogo)!.trasteInicial).toBe(1)
    })

    test('se desplaza al traste más grave pisado cuando el acorde es alto', () => {
      expect(buscarDigitacion('Alto', catalogo)!.trasteInicial).toBe(6)
      expect(buscarDigitacion('Medio', catalogo)!.trasteInicial).toBe(1)
    })
  })
})
