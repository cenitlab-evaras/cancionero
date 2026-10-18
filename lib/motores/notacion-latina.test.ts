import { describe, expect, test } from 'vitest'
import { americanaALatina, esNotacionLatina, latinaAAmericana } from './notacion-latina'

/**
 * H9 · docs/PRD.md §18-7.
 *
 * «La notación americana puede ser fricción real para músicos formados con el
 * cancionero impreso. Medirlo con el coro. Si estorba, el motor de mapeo
 * latina↔americana es pequeño y encaja como hito 9.»
 *
 * Se midió: la primera carga real de un canto vino en latina, porque el PDF del
 * *Cancionero Misionero* está en latina. Estorba.
 *
 * La conversión es en un solo sentido —latina → americana— porque el
 * almacenamiento es ChordPro americano (decisión 3) y la pantalla también. Esto
 * traduce lo que se escribe, no lo que se guarda.
 */

describe('latinaAAmericana', () => {
  test('las siete notas de la escala', () => {
    expect(latinaAAmericana('DO')).toBe('C')
    expect(latinaAAmericana('RE')).toBe('D')
    expect(latinaAAmericana('MI')).toBe('E')
    expect(latinaAAmericana('FA')).toBe('F')
    expect(latinaAAmericana('SOL')).toBe('G')
    expect(latinaAAmericana('LA')).toBe('A')
    expect(latinaAAmericana('SI')).toBe('B')
  })

  test('los acordes del canto que disparó este hito', () => {
    // "Escojo la vida", cargado tal como está en el cancionero.
    expect(latinaAAmericana('RE')).toBe('D')
    expect(latinaAAmericana('MIm7')).toBe('Em7')
    expect(latinaAAmericana('FA#m')).toBe('F#m')
    expect(latinaAAmericana('SOL')).toBe('G')
    expect(latinaAAmericana('LA')).toBe('A')
    expect(latinaAAmericana('MIm')).toBe('Em')
    expect(latinaAAmericana('DO')).toBe('C')
    expect(latinaAAmericana('SIm')).toBe('Bm')
  })

  test('conserva el sufijo, sea el que sea', () => {
    expect(latinaAAmericana('LAm')).toBe('Am')
    expect(latinaAAmericana('SOL7')).toBe('G7')
    expect(latinaAAmericana('REm7')).toBe('Dm7')
    expect(latinaAAmericana('DOmaj7')).toBe('Cmaj7')
    expect(latinaAAmericana('MIsus4')).toBe('Esus4')
    expect(latinaAAmericana('LA9')).toBe('A9')
  })

  test('conserva las alteraciones', () => {
    expect(latinaAAmericana('FA#')).toBe('F#')
    expect(latinaAAmericana('SIb')).toBe('Bb')
    expect(latinaAAmericana('DO#m')).toBe('C#m')
  })

  test('SOL se resuelve antes que SI: la nota más larga manda', () => {
    // Si se probara SI primero, "SOL" no llegaría a matchear nunca por prefijo.
    expect(latinaAAmericana('SOL')).toBe('G')
    expect(latinaAAmericana('SI')).toBe('B')
  })

  test('el bajo después de la barra también se traduce', () => {
    expect(latinaAAmericana('RE/FA#')).toBe('D/F#')
    expect(latinaAAmericana('LAm/SOL')).toBe('Am/G')
  })

  test('no toca lo que ya está en americana', () => {
    // Ninguna nota latina es prefijo de una americana, así que la conversión
    // es segura de aplicar dos veces.
    for (const a of ['D', 'Em7', 'F#m', 'G', 'A', 'Bm', 'C', 'Am7', 'D/F#']) {
      expect(latinaAAmericana(a)).toBe(a)
    }
  })

  test('es idempotente: convertir dos veces da lo mismo', () => {
    const una = latinaAAmericana('MIm7')
    expect(latinaAAmericana(una)).toBe(una)
  })

  test('minúsculas y mezcla: el cancionero escribe fa#m y FA#m', () => {
    expect(latinaAAmericana('fa#m')).toBe('F#m')
    expect(latinaAAmericana('Sol')).toBe('G')
    expect(latinaAAmericana('lam')).toBe('Am')
  })

  test('lo que no reconoce lo devuelve intacto, sin lanzar', () => {
    expect(latinaAAmericana('')).toBe('')
    expect(latinaAAmericana('Estribillo')).toBe('Estribillo')
    expect(latinaAAmericana('H9')).toBe('H9')
  })
})

describe('esNotacionLatina', () => {
  test('reconoce un texto escrito en latina', () => {
    expect(esNotacionLatina('RE MIm7 RE  LA')).toBe(true)
    expect(esNotacionLatina('FA#m    SOL     MIm')).toBe(true)
  })

  test('no confunde un texto en americana con latina', () => {
    expect(esNotacionLatina('D Em7 D  A')).toBe(false)
    expect(esNotacionLatina('[C]Gracias quiero [Am]darte')).toBe(false)
  })

  test('la letra de un canto no es notación latina', () => {
    // "la" y "mi" son palabras comunes en español: sin esta distinción, media
    // letra se leería como acordes.
    expect(esNotacionLatina('Esta mañana, enderezo mi espalda')).toBe(false)
    expect(esNotacionLatina('abro mi rostro, respiro la aurora')).toBe(false)
  })

  test('un texto vacío no es latina', () => {
    expect(esNotacionLatina('')).toBe(false)
    expect(esNotacionLatina('   ')).toBe(false)
  })
})

/**
 * Herramienta «Acordes en Do-Re-Mi» (2026-10-17): el sentido inverso, solo para
 * MOSTRAR. Lo guardado sigue siendo americano; esto se aplica al pintar.
 */
describe('americanaALatina', () => {
  test('las siete notas, con su sufijo intacto', () => {
    expect(['C', 'D', 'E', 'F', 'G', 'A', 'B'].map(americanaALatina)).toEqual([
      'Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si',
    ])
    expect(americanaALatina('Am')).toBe('Lam')
    expect(americanaALatina('F#m7')).toBe('Fa#m7')
    expect(americanaALatina('Bb')).toBe('Sib')
    expect(americanaALatina('Gmaj7')).toBe('Solmaj7')
    expect(americanaALatina('Csus4')).toBe('Dosus4')
  })

  test('el bajo de un acorde con barra también', () => {
    expect(americanaALatina('D/F#')).toBe('Re/Fa#')
    expect(americanaALatina('A9/C#')).toBe('La9/Do#')
  })

  test('lo que no es acorde pasa intacto', () => {
    expect(americanaALatina('')).toBe('')
    expect(americanaALatina('N.C.')).toBe('N.C.')
    expect(americanaALatina('x2')).toBe('x2')
  })

  test('ida y vuelta da lo mismo', () => {
    for (const a of ['C', 'C#m', 'Ebmaj7', 'F#7', 'G/B', 'Bm7b5']) {
      expect(latinaAAmericana(americanaALatina(a))).toBe(a)
    }
  })
})
