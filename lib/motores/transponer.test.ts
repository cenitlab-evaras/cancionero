import { describe, expect, test } from 'vitest'
import { normalizarSemitonos, transponer, transponerAcorde } from './transponer'

/**
 * H3 · docs/PRD.md §9 y reglas RN-13 y RN-16 del funcional.
 */
describe('la invariante del PRD', () => {
  test('`Am F C G` con +2 da `Bm G D A`', () => {
    expect(transponer('[Am] [F] [C] [G]', 2)).toBe('[Bm] [G] [D] [A]')
  })

  test('+12 devuelve el original carácter por carácter (RN-13)', () => {
    const original = `[E]Abre tu [F#m]jardín,
[G#m]traigo una [F#m]nueva [B]noticia;[B7]`
    expect(transponer(original, 12)).toBe(original)
    expect(transponer(original, -12)).toBe(original)
    expect(transponer(original, 0)).toBe(original)
  })

  test('los acordes dentro de un comentario también se transponen (RN-16)', () => {
    expect(transponer('{comment: Intro [C] [G]}', 2)).toBe('{comment: Intro [D] [A]}')
  })
})

describe('transponerAcorde', () => {
  test('sube y baja un semitono', () => {
    expect(transponerAcorde('F#m', 1)).toBe('Gm')
    expect(transponerAcorde('F#m', -1)).toBe('Fm')
  })

  test('cruza el fin de la octava sin perderse', () => {
    expect(transponerAcorde('B', 1)).toBe('C')
    expect(transponerAcorde('C', -1)).toBe('B')
  })

  test('conserva el sufijo entero', () => {
    expect(transponerAcorde('Am7', 2)).toBe('Bm7')
    expect(transponerAcorde('Csus4', 2)).toBe('Dsus4')
    expect(transponerAcorde('A9', 3)).toBe('C9')
    expect(transponerAcorde('Gmaj7', 1)).toBe('G#maj7')
  })

  test('transpone también el bajo de un acorde con barra', () => {
    expect(transponerAcorde('G/B', 2)).toBe('A/C#')
    expect(transponerAcorde('A9/C#', 1)).toBe('A#9/D')
    expect(transponerAcorde('Bm/A', 2)).toBe('C#m/B')
  })

  test('entiende los bemoles de entrada y responde en sostenidos', () => {
    expect(transponerAcorde('Bb', 1)).toBe('B')
    expect(transponerAcorde('Eb', 2)).toBe('F')
  })

  test('lo que no es un acorde se devuelve intacto', () => {
    expect(transponerAcorde('H9', 2)).toBe('H9')
    expect(transponerAcorde('', 2)).toBe('')
  })
})

describe('normalizarSemitonos — el ciclo de octava (RN-13)', () => {
  test('±12 vuelve a 0', () => {
    expect(normalizarSemitonos(12)).toBe(0)
    expect(normalizarSemitonos(-12)).toBe(0)
  })

  test('se mantiene dentro de -11..11', () => {
    expect(normalizarSemitonos(13)).toBe(1)
    expect(normalizarSemitonos(-13)).toBe(-1)
    expect(normalizarSemitonos(11)).toBe(11)
    expect(normalizarSemitonos(-11)).toBe(-11)
  })
})

describe('sobre el cifrado entero', () => {
  test('la letra no se toca: solo cambian los acordes', () => {
    const r = transponer('[E]Abre tu [F#m]jardín,', 2)
    expect(r).toBe('[F#]Abre tu [G#m]jardín,')
  })

  test('un cifrado sin acordes vuelve igual', () => {
    expect(transponer('Vive la palabra, luego vivirás.', 5)).toBe('Vive la palabra, luego vivirás.')
  })

  test('transponer dos veces equivale a transponer la suma', () => {
    const c = '[C]Hola [Am]mundo [F]bonito'
    expect(transponer(transponer(c, 3), 4)).toBe(transponer(c, 7))
  })
})
