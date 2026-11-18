import { describe, expect, test } from 'vitest'
import { aChordPro, desdeElCancionero, pareceAcordesSobreLetra } from './acordes-sobre-letra'
import { renderizarCifrado } from './renderizar-cifrado'

/**
 * H9 · RF-26 y RF-27 de docs/FUNCIONAL.md.
 *
 * El cancionero impreso —y cualquier músico— escribe los acordes en una línea
 * aparte, alineados sobre la sílaba donde caen. El almacenamiento sigue siendo
 * ChordPro (RF-27: «el almacenamiento interno es siempre ChordPro»), así que
 * esto convierte al pegar, no cambia lo que se guarda.
 *
 * Es el inverso de `renderizarCifrado`, y por eso el test que más vale es el de
 * ida y vuelta.
 */

describe('aChordPro', () => {
  test('pone cada acorde en la columna donde estaba', () => {
    const entrada = ['C       G', 'Gracias quiero'].join('\n')
    expect(aChordPro(entrada)).toBe('[C]Gracias [G]quiero')
  })

  test('el acorde en la columna 0 va al principio', () => {
    expect(aChordPro('D\nSeñor')).toBe('[D]Señor')
  })

  test('respeta las columnas aunque los acordes vengan en latina', () => {
    // Este motor NO traduce la notación: solo mueve los acordes a su columna.
    // Traducir es trabajo de `latinaAAmericana`, y componerlos es `desdeElCancionero`.
    const entrada = ['FA#m    SOL     MIm          LA', 'abro mi rostro, respiro la aurora'].join(
      '\n'
    )
    expect(aChordPro(entrada)).toBe('[FA#m]abro mi [SOL]rostro, [MIm]respiro la au[LA]rora')
  })

  test('un acorde más allá del final de la letra se pega al final', () => {
    // Pasa siempre en la última línea de una estrofa.
    expect(aChordPro('C        G\nCorto')).toBe('[C]Corto[G]')
  })

  test('una línea de acordes SIN letra debajo queda como línea de acordes sola', () => {
    // Los intros e interludios se escriben así.
    expect(aChordPro('D Em7 D Em7')).toBe('[D] [Em7] [D] [Em7]')
  })

  test('una línea de letra sin acordes arriba se conserva como está', () => {
    expect(aChordPro('Esta mañana, enderezo mi espalda')).toBe('Esta mañana, enderezo mi espalda')
  })

  test('las líneas en blanco se conservan: separan las estrofas', () => {
    const entrada = ['C', 'uno', '', 'G', 'dos'].join('\n')
    expect(aChordPro(entrada)).toBe(['[C]uno', '', '[G]dos'].join('\n'))
  })

  test('no toca un cifrado que YA está en ChordPro', () => {
    // Si alguien pega ChordPro por error, convertirlo lo destruiría.
    const yaEsta = '[C]Gracias quiero [Am]darte'
    expect(aChordPro(yaEsta)).toBe(yaEsta)
  })

  test('IDA Y VUELTA · lo convertido, al renderizarse, vuelve a las mismas columnas', () => {
    // El test que de verdad prueba el motor: si las columnas no coinciden, el
    // acorde terminó sobre otra sílaba y el músico toca mal.
    const entrada = ['C       G        Am', 'Gracias quiero darte por amarme'].join('\n')

    const { lineas } = renderizarCifrado(aChordPro(entrada), { ancho: 200 })
    const columnas = lineas[0].acordes.map((a) => `${a.acorde}@${a.columna}`)

    expect(columnas).toEqual(['C@0', 'G@8', 'Am@17'])
  })

  test('varias estrofas seguidas', () => {
    const entrada = [
      'D       Em7',
      'Esta mañana,',
      'G   A',
      'escojo la vida.',
    ].join('\n')

    // La columna 8 de «Esta mañana,» cae en la SEGUNDA "a": el acorde va ahí,
    // no donde el ojo cree. Esa precisión es todo el punto del motor.
    expect(aChordPro(entrada)).toBe(['[D]Esta mañ[Em7]ana,', '[G]esco[A]jo la vida.'].join('\n'))
  })
})

describe('desdeElCancionero · los dos motores compuestos', () => {
  test('el canto que disparó el hito, tal como está en el PDF', () => {
    // Latina + acordes sobre letra, que es como se copia del cancionero.
    const entrada = ['FA#m    SOL     MIm          LA', 'abro mi rostro, respiro la aurora'].join(
      '\n'
    )
    expect(desdeElCancionero(entrada)).toBe('[F#m]abro mi [G]rostro, [Em]respiro la au[A]rora')
  })

  test('la primera estrofa entera de «Escojo la vida»', () => {
    const entrada = [
      'RE MIm7 RE MIm7 RE  LA        RE',
      '  Esta mañana,  enderezo mi espalda,',
      'FA#m    SOL     MIm          LA',
      'abro mi rostro, respiro la aurora',
    ].join('\n')

    const salida = desdeElCancionero(entrada)
    expect(salida).toContain('[D]')
    expect(salida).toContain('[Em7]')
    expect(salida).toContain('[F#m]')
    expect(salida).not.toContain('RE')
    expect(salida).not.toContain('SOL')
  })

  test('un cifrado ya en ChordPro americano pasa intacto', () => {
    const yaEsta = '[C]Gracias quiero [Am]darte'
    expect(desdeElCancionero(yaEsta)).toBe(yaEsta)
  })

  test('solo latina, sin cambiar de formato', () => {
    // Alguien puede escribir ChordPro pero con notación latina.
    expect(desdeElCancionero('[RE]Señor, toma mi [SOL]vida')).toBe('[D]Señor, toma mi [G]vida')
  })
})

describe('pareceAcordesSobreLetra', () => {
  test('reconoce el formato del cancionero', () => {
    const entrada = ['C       G', 'Gracias quiero'].join('\n')
    expect(pareceAcordesSobreLetra(entrada)).toBe(true)
  })

  test('reconoce el formato aunque venga en latina', () => {
    const entrada = ['RE MIm7 RE  LA', '  Esta mañana,  enderezo mi espalda,'].join('\n')
    expect(pareceAcordesSobreLetra(entrada)).toBe(true)
  })

  test('NO confunde un ChordPro válido', () => {
    expect(pareceAcordesSobreLetra('[C]Gracias quiero [Am]darte')).toBe(false)
  })

  test('NO confunde un canto que es solo letra', () => {
    const soloLetra = ['Esta mañana, enderezo mi espalda,', 'abro mi rostro, respiro la aurora'].join(
      '\n'
    )
    expect(pareceAcordesSobreLetra(soloLetra)).toBe(false)
  })

  test('un texto vacío no parece nada', () => {
    expect(pareceAcordesSobreLetra('')).toBe(false)
  })
})

describe('desdeElCancionero · restos del cancionero (2026-11-18)', () => {
  // El libro envuelve las intros entre paréntesis que ABARCAN DOS LÍNEAS, numera
  // variantes con «1)», y algunas líneas mezclan barras de repetición. Todo eso
  // quedaba como texto plano en el repertorio (el QA encontró ~84 cantos así).
  test('la intro entre paréntesis en dos líneas queda como líneas de acordes, sin fundirse', () => {
    const texto = '(SOL RE/FA# mim mim/re\nDO SOL/SI lam7 RE)\nY ven todo es fiesta'
    expect(desdeElCancionero(texto)).toBe(
      '[G] [D/F#] [Em] [Em/D]\n[C] [G/B] [Am7] [D]\nY ven todo es fiesta'
    )
  })

  test('una anotación «1)» no impide reconocer la línea; la línea queda sola (intro)', () => {
    // Al dropear «1)» las columnas dejan de ser las del verso: fundirlas pondría
    // los acordes dentro de las palabras. Se leen como intro, y el verso queda.
    expect(desdeElCancionero('1) FA SOL DO mim lam\nCantamos al Señor')).toBe(
      '[F] [G] [C] [Em] [Am]\nCantamos al Señor'
    )
  })

  test('las barras de repetición se ignoran', () => {
    expect(desdeElCancionero('|: LA RE | MI LA :|\nAbre tu jardín')).toBe(
      '[A] [D] [E] [A]\nAbre tu jardín'
    )
  })

  test('los sufijos del libro (7+, m7, /bajo) se convierten conservando la columna', () => {
    expect(desdeElCancionero('DO7+ RE/DO SOL\nGracias Señor')).toBe(
      '[C7+]Graci[D/C]as Señ[G]or'
    )
  })

  test('la letra que empieza con sílabas de nota NO se toma por acordes', () => {
    expect(desdeElCancionero('las mis')).toBe('las mis')
    expect(desdeElCancionero('respiro la aurora')).toBe('respiro la aurora')
  })
})
