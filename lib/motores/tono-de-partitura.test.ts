import { describe, expect, test } from 'vitest'
import { intervaloParaTransponer, semitonosDeLaPartitura, tonicaDeArmadura } from './tono-de-partitura'

/**
 * H28 · El tono elegido, llevado a la partitura y a las pistas de «Ensayar».
 *
 * El tono de una persona (o el de la misa) se guarda en semitonos sobre el
 * cifrado. La partitura puede estar escrita en otra tonalidad que el cifrado:
 * lo que importa es que el coro cante en la MISMA que tocan las guitarras.
 */

describe('tonicaDeArmadura', () => {
  test('mayores por la armadura (fifths de MusicXML)', () => {
    expect(tonicaDeArmadura(0, false)).toBe(0) // Do
    expect(tonicaDeArmadura(-1, false)).toBe(5) // Fa
    expect(tonicaDeArmadura(1, false)).toBe(7) // Sol
    expect(tonicaDeArmadura(-3, false)).toBe(3) // Mi bemol
    expect(tonicaDeArmadura(6, false)).toBe(6) // Fa sostenido
  })

  test('menores: la relativa, tres semitonos abajo', () => {
    expect(tonicaDeArmadura(0, true)).toBe(9) // La menor
    expect(tonicaDeArmadura(-1, true)).toBe(2) // Re menor
  })
})

describe('semitonosDeLaPartitura', () => {
  test('cifrado y partitura en la misma tonalidad: los mismos semitonos', () => {
    expect(semitonosDeLaPartitura({ transposicion: 2, tonalidadCifrado: 'F', armadura: -1, menor: false })).toBe(2)
    expect(semitonosDeLaPartitura({ transposicion: -3, tonalidadCifrado: 'F', armadura: -1, menor: false })).toBe(-3)
  })

  test('sin tonalidad del cifrado se confía en los semitonos', () => {
    expect(semitonosDeLaPartitura({ transposicion: 4, tonalidadCifrado: null, armadura: 2, menor: false })).toBe(4)
  })

  test('cifrado en otra tonalidad: se llega a la misma que tocan las guitarras', () => {
    // Cifrado en Re, partitura en Fa. El tono original del cifrado es Re:
    // sin transponer, el coro tiene que cantar en Re → la partitura baja 3.
    expect(semitonosDeLaPartitura({ transposicion: 0, tonalidadCifrado: 'D', armadura: -1, menor: false })).toBe(-3)
    // +2 sobre el cifrado = Mi → la partitura en Fa baja 1.
    expect(semitonosDeLaPartitura({ transposicion: 2, tonalidadCifrado: 'D', armadura: -1, menor: false })).toBe(-1)
  })

  test('se entiende la tonalidad escrita con bemol o en menor', () => {
    expect(semitonosDeLaPartitura({ transposicion: 0, tonalidadCifrado: 'Bb', armadura: -2, menor: false })).toBe(0)
    expect(semitonosDeLaPartitura({ transposicion: 0, tonalidadCifrado: 'Dm', armadura: -1, menor: true })).toBe(0)
  })

  test('siempre el camino más corto, entre -6 y +5: una pista corrida 7 semitonos suena mal', () => {
    expect(semitonosDeLaPartitura({ transposicion: 7, tonalidadCifrado: 'F', armadura: -1, menor: false })).toBe(-5)
    expect(semitonosDeLaPartitura({ transposicion: -7, tonalidadCifrado: 'F', armadura: -1, menor: false })).toBe(5)
    expect(semitonosDeLaPartitura({ transposicion: 6, tonalidadCifrado: 'F', armadura: -1, menor: false })).toBe(-6)
    expect(semitonosDeLaPartitura({ transposicion: 11, tonalidadCifrado: null, armadura: null, menor: false })).toBe(-1)
  })
})

describe('intervaloParaTransponer — la opción `transpose` de Verovio', () => {
  test('cero es no transponer', () => {
    expect(intervaloParaTransponer(0, [-1, 1])).toBe('')
  })

  test('arriba y abajo con el signo de Verovio', () => {
    expect(intervaloParaTransponer(2, [-1])).toBe('+M2')
    expect(intervaloParaTransponer(-3, [-1])).toBe('-m3')
    expect(intervaloParaTransponer(5, [0])).toBe('+P4')
    expect(intervaloParaTransponer(-5, [0])).toBe('-P4')
  })

  test('elige la escritura con menos alteraciones en TODAS las armaduras del canto', () => {
    // Fa y Sol (Cantaré por siempre) un semitono arriba: Solb y Lab (6 y 4
    // bemoles), no Fa# y Sol# (6 y 8 sostenidos, que no existe).
    expect(intervaloParaTransponer(1, [-1, 1])).toBe('+m2')
    // Un semitono abajo: Mi y Fa#, no Fab.
    expect(intervaloParaTransponer(-1, [-1, 1])).toBe('-m2')
    // Do subiendo un tritono: Fa# (6 #) o Solb (6 b) empatan; manda la primera.
    expect(['+A4', '+d5']).toContain(intervaloParaTransponer(6, [0]))
    // Sol subiendo 3: Sib (2 b), no La# (10 #).
    expect(intervaloParaTransponer(3, [1])).toBe('+m3')
    // Re bajando 1: Reb (5 b, unísono aumentado abajo), no Do# (7 #, segunda menor).
    expect(intervaloParaTransponer(-1, [2])).toBe('-A1')
    // Mib subiendo 1: Mi (4 #), no Fab (8 b).
    expect(intervaloParaTransponer(1, [-3])).toBe('+A1')
  })
})
