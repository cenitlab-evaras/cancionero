import { describe, expect, test } from 'vitest'
import { DIGITACIONES } from './digitaciones'
import { buscarDigitacion } from './buscar-digitacion'
import { acordesDeCanto } from './acordes-de-canto'
import { transponer } from './transponer'
import { CANTOS } from '../../supabase/seed/cantos.ts'

/**
 * H5 · la red que en otros hitos pone la RLS.
 *
 * H5 no crea ninguna tabla, así que no hay política que lo proteja. Lo que
 * ocupa ese lugar en la rebanada es este archivo: comprueba que el catálogo
 * cubre el repertorio REAL en TODAS las transposiciones, y que su forma es
 * consistente.
 *
 * El día que H8 permita escribir un `Dsus4`, el primer test se pone rojo solo.
 * Eso es exactamente lo que tiene que pasar.
 */

const RAICES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const SUFIJOS = ['', 'm', '7', 'm7']

describe('cobertura del catálogo', () => {
  test('ningún acorde del repertorio sembrado queda sin digitación, en ninguna tonalidad', () => {
    const faltantes = new Set<string>()

    for (const canto of CANTOS) {
      for (let semitonos = -11; semitonos <= 11; semitonos++) {
        for (const acorde of acordesDeCanto(transponer(canto.cifrado, semitonos))) {
          // Los acordes con bajo devuelven `null` por decisión declarada: no
          // son un hueco del catálogo, son un pendiente escrito en el PRD.
          if (acorde.includes('/')) continue
          if (buscarDigitacion(acorde, DIGITACIONES) === null) faltantes.add(acorde)
        }
      }
    }

    expect([...faltantes].sort()).toEqual([])
  })

  test('los acordes con bajo son los únicos sin digitación, y están acotados', () => {
    const conBajo = new Set<string>()
    for (const canto of CANTOS) {
      for (const acorde of acordesDeCanto(canto.cifrado)) {
        if (acorde.includes('/')) conBajo.add(acorde)
      }
    }
    // Si este número crece, alguien agregó repertorio con bajos y conviene
    // revisar la decisión antes de que sea la mitad del cancionero.
    expect(conBajo.size).toBeLessThanOrEqual(7)
  })
})

describe('forma del catálogo', () => {
  test('están las 48 entradas esperadas: 12 raíces × 4 sufijos', () => {
    const esperadas = RAICES.flatMap((r) => SUFIJOS.map((s) => r + s))
    expect(Object.keys(DIGITACIONES).sort()).toEqual(esperadas.sort())
  })

  test('toda digitación tiene seis cuerdas, en trastes dibujables', () => {
    for (const [nombre, d] of Object.entries(DIGITACIONES)) {
      expect(d.cuerdas, nombre).toHaveLength(6)
      expect(d.cuerdas, nombre).toMatch(/^[x0-9]{6}$/)
    }
  })

  test('ninguna clave lleva bemol ni bajo: el motor normaliza antes de buscar', () => {
    for (const nombre of Object.keys(DIGITACIONES)) {
      expect(nombre, nombre).not.toContain('b')
      expect(nombre, nombre).not.toContain('/')
    }
  })

  test('la cejilla es coherente con las cuerdas que declara', () => {
    for (const [nombre, d] of Object.entries(DIGITACIONES)) {
      if (!d.cejilla) continue
      const { traste, desde, hasta } = d.cejilla

      for (let i = desde; i <= hasta; i++) {
        const c = d.cuerdas[i]
        // Una cuerda bajo la cejilla no puede estar muda ni sonar más grave
        // que el traste que el dedo está pisando.
        expect(c, `${nombre} · cuerda ${i}`).not.toBe('x')
        expect(Number(c), `${nombre} · cuerda ${i}`).toBeGreaterThanOrEqual(traste)
      }

      // Y el traste de la cejilla es el más grave de todo el acorde.
      const pisados = [...d.cuerdas].filter((c) => c !== 'x' && c !== '0').map(Number)
      expect(Math.min(...pisados), nombre).toBe(traste)
    }
  })

  test('las cuerdas mudas de una forma de la son solo la sexta', () => {
    for (const [nombre, d] of Object.entries(DIGITACIONES)) {
      const mudas = [...d.cuerdas].map((c, i) => (c === 'x' ? i : -1)).filter((i) => i >= 0)
      // Las mudas van siempre desde la 6ª hacia abajo, nunca en el medio:
      // una muda intercalada no se puede tocar sin apagarla con la mano.
      expect(mudas, nombre).toEqual(mudas.map((_, i) => i))
    }
  })
})
