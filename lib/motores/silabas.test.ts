import { describe, expect, test } from 'vitest'
import { silabear, iniciosDeSilaba } from './silabas'

/**
 * H19-B · Silabeo en español — las paradas de «moverlo de sílaba».
 *
 * Lo que este motor tiene que garantizar:
 *
 *  1. **Que «can-ción» y «sal-va-ción» se partan donde se cantan.** Mover un
 *     acorde «una sílaba» solo sirve si la sílaba es la que oye el coro: por
 *     letra sería impreciso en un teléfono y por palabra demasiado grueso —
 *     media corrección de los importados cae dentro de una palabra.
 *  2. **Los diptongos no se parten y los hiatos sí.** «Dios» es una sílaba,
 *     «Ma-rí-a» son tres. Si se equivoca acá, el acorde aterriza a mitad de
 *     una vocal.
 *  3. **Las columnas son las de la letra**, con tildes, eñes y puntuación, para
 *     que la parada caiga exactamente bajo el carácter que se ve.
 */

describe('silabear', () => {
  test.each([
    ['canción', ['can', 'ción']],
    ['salvación', ['sal', 'va', 'ción']],
    ['jardín', ['jar', 'dín']],
    ['vida', ['vi', 'da']],
    ['Señor', ['Se', 'ñor']],
    ['fortaleza', ['for', 'ta', 'le', 'za']],
  ])('consonante simple y grupos sueltos: %s', (palabra, esperado) => {
    expect(silabear(palabra)).toEqual(esperado)
  })

  test.each([
    ['Dios', ['Dios']],
    ['cielo', ['cie', 'lo']],
    ['tiempo', ['tiem', 'po']],
    ['cuida', ['cui', 'da']],
    ['aire', ['ai', 're']],
    ['guerra', ['gue', 'rra']],
    ['que', ['que']],
  ])('diptongos que no se parten: %s', (palabra, esperado) => {
    expect(silabear(palabra)).toEqual(esperado)
  })

  test.each([
    ['María', ['Ma', 'rí', 'a']],
    ['poeta', ['po', 'e', 'ta']],
    ['día', ['dí', 'a']],
    ['oír', ['o', 'ír']],
    ['leer', ['le', 'er']],
  ])('hiatos que sí se parten: %s', (palabra, esperado) => {
    expect(silabear(palabra)).toEqual(esperado)
  })

  test.each([
    ['padre', ['pa', 'dre']],
    ['gloria', ['glo', 'ria']],
    ['siempre', ['siem', 'pre']],
    ['hombre', ['hom', 'bre']],
    ['pueblo', ['pue', 'blo']],
    ['instante', ['ins', 'tan', 'te']],
    ['construir', ['cons', 'truir']],
  ])('grupos inseparables y tres consonantes: %s', (palabra, esperado) => {
    expect(silabear(palabra)).toEqual(esperado)
  })

  test.each([
    ['calle', ['ca', 'lle']],
    ['noche', ['no', 'che']],
    ['tierra', ['tie', 'rra']],
    ['ahora', ['a', 'ho', 'ra']],
  ])('ch, ll y rr cuentan como una consonante; la h es consonante: %s', (palabra, esperado) => {
    expect(silabear(palabra)).toEqual(esperado)
  })

  test('la y final es vocal y no abre sílaba: rey, hoy', () => {
    expect(silabear('rey')).toEqual(['rey'])
    expect(silabear('hoy')).toEqual(['hoy'])
    expect(silabear('reyes')).toEqual(['re', 'yes'])
  })

  test('las sílabas vuelven a formar la palabra, siempre', () => {
    for (const p of ['Aleluya', 'resplandeciente', 'transfiguración', 'pingüino', 'a', 'y']) {
      expect(silabear(p).join('')).toBe(p)
    }
  })
})

describe('iniciosDeSilaba', () => {
  test('cada palabra y cada sílaba de la línea, en su columna real', () => {
    //            0123456789012345678901
    const texto = 'Abre tu jardín'
    // A·bre · tu · jar·dín
    expect(iniciosDeSilaba(texto)).toEqual([0, 1, 5, 8, 11])
  })

  test('la puntuación y los espacios no son paradas', () => {
    //             0123456789
    const texto = '¡Oh, Dios!'
    expect(iniciosDeSilaba(texto)).toEqual([1, 5])
  })

  test('una línea sin letras no tiene paradas', () => {
    expect(iniciosDeSilaba('   ')).toEqual([])
    expect(iniciosDeSilaba('')).toEqual([])
    expect(iniciosDeSilaba('- 2 - (…)')).toEqual([])
  })

  test('las columnas cuentan la eñe y las tildes como un carácter', () => {
    //             0123456789
    const texto = 'mañana sí'
    expect(iniciosDeSilaba(texto)).toEqual([0, 2, 4, 7])
  })
})
