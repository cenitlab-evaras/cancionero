import { describe, expect, test } from 'vitest'
import { renderizarCifrado } from './renderizar-cifrado'

/**
 * H2 · docs/PRD.md §9. La invariante del PRD, con una corrección:
 *   `U[C]sing the [Dm]chordPro format[G]` sobre el texto "Using the chordPro
 *   format" (25 caracteres) pone C en la columna **1** —el corchete va después
 *   de la "U", así que el acorde cae sobre la "s"—, Dm en la 10 y G en la 25.
 *
 * El PRD decía columna 0 para C. Es un error de redacción: el número real es 1,
 * y una invariante vale por ser comprobable, no por estar escrita. Corregido
 * también en el PRD §9 y §15.
 */
describe('la invariante del PRD', () => {
  const [linea] = renderizarCifrado('U[C]sing the [Dm]chordPro format[G]').lineas

  test('el texto queda limpio de corchetes', () => {
    expect(linea.texto).toBe('Using the chordPro format')
    expect(linea.texto).toHaveLength(25)
  })

  test('los tres acordes caen en las columnas 1, 10 y 25', () => {
    expect(linea.acordes.map((a) => [a.acorde, a.columna])).toEqual([
      ['C', 1],
      ['Dm', 10],
      ['G', 25],
    ])
  })
})

describe('estructura del cifrado', () => {
  test('una línea sin acordes se devuelve tal cual, con la lista vacía', () => {
    const { lineas } = renderizarCifrado('Vamos por ahí, cantando la buena nueva.')
    expect(lineas).toHaveLength(1)
    expect(lineas[0].texto).toBe('Vamos por ahí, cantando la buena nueva.')
    expect(lineas[0].acordes).toEqual([])
  })

  test('una línea de solo acordes deja el texto vacío y conserva los acordes', () => {
    const { lineas } = renderizarCifrado('[G][C][G][C]')
    expect(lineas[0].texto).toBe('')
    expect(lineas[0].acordes.map((a) => a.acorde)).toEqual(['G', 'C', 'G', 'C'])
  })

  test('las líneas en blanco se conservan: separan estrofas', () => {
    const { lineas } = renderizarCifrado('[C]Una\n\n[D]Otra')
    expect(lineas).toHaveLength(3)
    expect(lineas[1].texto).toBe('')
    expect(lineas[1].acordes).toEqual([])
    expect(lineas[1].esSeparador).toBe(true)
  })

  test('cuenta las líneas y los acordes del cifrado entero', () => {
    const r = renderizarCifrado('[C]Una\n[D]Otra')
    expect(r.lineas).toHaveLength(2)
    expect(r.totalAcordes).toBe(2)
  })
})

describe('acordes que caerían encima de otro', () => {
  /**
   * Caso real de la semilla: el cancionero es de dos columnas y no dice sobre
   * qué sílaba cae cada acorde, así que se transcriben agrupados al comienzo de
   * la línea. Sin separarlos, `[E][F#m]` se pintaría uno encima del otro.
   */
  test('dos acordes en la misma columna se separan por un espacio al pintarlos', () => {
    const [linea] = renderizarCifrado('[E][F#m]Abre tu jardín,').lineas
    expect(linea.texto).toBe('Abre tu jardín,')
    expect(linea.acordes.map((a) => [a.acorde, a.columna])).toEqual([
      ['E', 0],
      ['F#m', 0],
    ])
    // La columna es el dato del cifrado; `columnaPintada` es dónde se dibuja
    // sin solaparse: E ocupa 0-0 y F#m arranca en 2 (1 de ancho + 1 de aire).
    expect(linea.acordes.map((a) => a.columnaPintada)).toEqual([0, 2])
  })

  test('un acorde largo empuja al siguiente lo necesario', () => {
    const [linea] = renderizarCifrado('[A9/C#][D]Hola').lineas
    // "A9/C#" son 5 caracteres: ocupa 0-4, más 1 de aire → D arranca en 6.
    expect(linea.acordes.map((a) => a.columnaPintada)).toEqual([0, 6])
  })

  test('si hay lugar de sobra, cada acorde se pinta en su columna real', () => {
    const [linea] = renderizarCifrado('[C]Hola que [G]tal').lineas
    expect(linea.acordes.map((a) => a.columnaPintada)).toEqual([0, 9])
  })
})

describe('directivas ChordPro', () => {
  test('un comentario se marca como tal y se muestra sin llaves', () => {
    const { lineas } = renderizarCifrado('{comment: Estribillo}')
    expect(lineas[0].texto).toBe('Estribillo')
    expect(lineas[0].esComentario).toBe(true)
  })

  test('las metaetiquetas de título y artista no se pintan (RF-28)', () => {
    const { lineas } = renderizarCifrado('{title: Abre tu jardín}\n[C]Letra')
    expect(lineas).toHaveLength(1)
    expect(lineas[0].texto).toBe('Letra')
  })
})

describe('ajuste de línea al ancho (RF-17)', () => {
  const largo = '[C]Gloria a Dios en el Cielo, y en la tierra [G]Paz a los hombres'

  test('sin ancho declarado, la línea no se parte', () => {
    expect(renderizarCifrado(largo).lineas).toHaveLength(1)
  })

  test('con ancho 20, ninguna línea supera las 20 columnas', () => {
    const { lineas } = renderizarCifrado(largo, { ancho: 20 })
    expect(lineas.length).toBeGreaterThan(1)
    for (const l of lineas) expect(l.texto.length).toBeLessThanOrEqual(20)
  })

  test('no parte palabras al medio: corta en el espacio', () => {
    const { lineas } = renderizarCifrado('[C]Gloria a Dios en el Cielo', { ancho: 12 })
    expect(lineas.map((l) => l.texto)).toEqual(['Gloria a', 'Dios en el', 'Cielo'])
  })

  test('cada acorde viaja al trozo que le toca, con su columna recalculada', () => {
    const { lineas } = renderizarCifrado(largo, { ancho: 20 })
    // El C abre la primera línea…
    expect(lineas[0].acordes[0]).toMatchObject({ acorde: 'C', columna: 0 })
    // …y el G aparece más adelante, ya no en la columna 44 del original.
    const conG = lineas.find((l) => l.acordes.some((a) => a.acorde === 'G'))!
    const g = conG.acordes.find((a) => a.acorde === 'G')!
    expect(g.columna).toBeLessThan(20)
    expect(conG.texto.slice(g.columna)).toMatch(/^Paz/)
  })

  test('una palabra más larga que el ancho no cuelga el motor', () => {
    const { lineas } = renderizarCifrado('[C]Supercalifragilisticoespialidoso', { ancho: 10 })
    expect(lineas.length).toBeGreaterThan(1)
    expect(lineas.every((l) => l.texto.length <= 10)).toBe(true)
  })
})

describe('entradas degeneradas: no revientan', () => {
  test('cifrado vacío devuelve cero líneas', () => {
    expect(renderizarCifrado('').lineas).toEqual([])
  })

  test('un corchete sin cerrar se trata como texto, no rompe el resto', () => {
    const { lineas } = renderizarCifrado('[C]Bien\n[Dsin cerrar')
    expect(lineas).toHaveLength(2)
    expect(lineas[1].texto).toBe('[Dsin cerrar')
    expect(lineas[1].acordes).toEqual([])
  })
})

describe('modo solo letra (H11)', () => {
  const CANTO = '[C]Una línea\n[G][D]\n\n{comment: Estribillo}\n[Am]Otra línea'

  test('sin la opción, todo sigue como en H2: los acordes están', () => {
    // La red que protege a los ocho hitos anteriores: el default no cambia.
    const r = renderizarCifrado(CANTO)
    expect(r.totalAcordes).toBe(4)
  })

  test('con `mostrarAcordes: false` no queda ni un acorde', () => {
    const r = renderizarCifrado(CANTO, { mostrarAcordes: false })
    expect(r.totalAcordes).toBe(0)
    expect(r.lineas.every((l) => l.acordes.length === 0)).toBe(true)
  })

  test('la letra queda intacta, carácter por carácter', () => {
    // Apagar los acordes no puede mover una sola letra: es la MISMA lectura,
    // sin el andamiaje de arriba.
    const con = renderizarCifrado(CANTO)
    const sin = renderizarCifrado(CANTO, { mostrarAcordes: false })
    const letra = (r: ReturnType<typeof renderizarCifrado>) =>
      r.lineas.filter((l) => !l.esSeparador && l.texto.trim() !== '').map((l) => l.texto)
    expect(letra(sin)).toEqual(letra(con))
  })

  test('una línea que era SOLO acordes desaparece, no deja un hueco', () => {
    // `[G][D]` es una intro sin letra. Sin acordes no le queda nada que decir:
    // dejarla como línea vacía abriría un agujero en medio de la estrofa.
    const sin = renderizarCifrado('[C]Una línea\n[G][D]\n[Am]Otra línea', {
      mostrarAcordes: false,
    })
    expect(sin.lineas.map((l) => l.texto)).toEqual(['Una línea', 'Otra línea'])
  })

  test('los separadores de estrofa y los comentarios se conservan', () => {
    // La estructura del canto no es andamiaje: separa estrofa de estribillo y
    // es lo que hace legible la letra sola.
    const sin = renderizarCifrado(CANTO, { mostrarAcordes: false })
    expect(sin.lineas.filter((l) => l.esSeparador)).toHaveLength(1)
    expect(sin.lineas.filter((l) => l.esComentario).map((l) => l.texto)).toEqual(['Estribillo'])
  })

  test('el ajuste al ancho sigue funcionando sin acordes', () => {
    const largo = 'Vamos por ahí cantando la buena nueva que nos trae la vida'
    const sin = renderizarCifrado(`[C]${largo}`, { ancho: 20, mostrarAcordes: false })
    expect(sin.lineas.length).toBeGreaterThan(1)
    expect(sin.lineas.every((l) => l.texto.length <= 20)).toBe(true)
    expect(sin.totalAcordes).toBe(0)
  })
})
