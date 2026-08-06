import { describe, expect, test } from 'vitest'
import { acordesDeCanto } from './acordes-de-canto'
import { transponer } from './transponer'
import { CANTOS } from '../../supabase/seed/cantos.ts'

/**
 * H5 · docs/PRD.md §9.
 *
 * El invariante que manda está escrito en el PRD con nombre y apellido: el
 * cifrado sembrado de *Abre tu jardín* devuelve seis acordes, en orden de
 * primera aparición y sin duplicados. Por eso el test lee el cifrado REAL de la
 * semilla y no una copia: si alguien corrige un corchete allá, esto se entera.
 *
 * El alias `@/` no existe en vitest (ver `vitest.config.mts`): los imports de
 * este archivo son relativos a propósito.
 */

const abreTuJardin = CANTOS.find((c) => c.titulo === 'Abre tu jardín')!.cifrado

describe('acordesDeCanto', () => {
  test('INVARIANTE §9 · Abre tu jardín devuelve exactamente sus seis acordes', () => {
    expect(acordesDeCanto(abreTuJardin)).toEqual(['E', 'F#m', 'G#m', 'B', 'B7', 'A'])
  })

  test('el orden es el de primera aparición, no el alfabético', () => {
    expect(acordesDeCanto('[G] [C] [G] [D]')).toEqual(['G', 'C', 'D'])
  })

  test('los repetidos se colapsan en uno solo', () => {
    // El cifrado sembrado repite E y F#m muchas veces y aun así son seis.
    expect(acordesDeCanto('[C][C][C]')).toEqual(['C'])
    expect(acordesDeCanto(abreTuJardin)).toHaveLength(6)
  })

  test('un cifrado con letra pero sin acordes devuelve lista vacía, no null', () => {
    // Es lo que habilita el estado vacío de §14: "este canto no tiene acordes
    // escritos" es distinto de un fallo del motor.
    expect(acordesDeCanto('Solo letra, sin un solo corchete')).toEqual([])
  })

  test('el cifrado vacío o en blanco devuelve lista vacía', () => {
    expect(acordesDeCanto('')).toEqual([])
    expect(acordesDeCanto('   \n  \n')).toEqual([])
  })

  test('distingue los acordes por su nombre exacto', () => {
    expect(acordesDeCanto('[C] [C7] [Cm] [A] [Am]')).toEqual(['C', 'C7', 'Cm', 'A', 'Am'])
  })

  test('un acorde irreconocible entra igual en la lista', () => {
    // No se filtra acá: tiene que llegar a la barra para que la barra pueda
    // decir "sin digitación para «H9»" (§14). Filtrarlo lo haría desaparecer
    // en silencio, que es justo lo que el PRD no quiere.
    expect(acordesDeCanto('[C] [H9]')).toEqual(['C', 'H9'])
  })

  test('un corchete vacío no genera entrada', () => {
    expect(acordesDeCanto('[] [C]')).toEqual(['C'])
  })

  test('las metaetiquetas no aportan acordes', () => {
    expect(acordesDeCanto('{title: Abre tu jardín}\n{key: E}\n[C]')).toEqual(['C'])
  })

  test('los acordes escritos dentro de un {comment:} sí cuentan', () => {
    // Coherente con `transponer`, que ya los transpone (RN-16). Si el motor de
    // transposición los toca, la barra tiene que dibujarlos.
    expect(acordesDeCanto('{comment: Intro [C] [G]}')).toEqual(['C', 'G'])
  })

  test('COMPOSICIÓN §9 · la lista se calcula sobre el cifrado YA transpuesto', () => {
    // El PRD advierte este bug por su nombre: si los diagramas se calculan
    // sobre el original, con +2 la pantalla dice F# y el diagrama dibuja E.
    const transpuesto = acordesDeCanto(transponer(abreTuJardin, 2))
    expect(transpuesto).toEqual(['F#', 'G#m', 'A#m', 'C#', 'C#7', 'B'])
    expect(transpuesto).not.toContain('E')
  })

  test('con +12 la lista vuelve a ser la original (RN-13)', () => {
    expect(acordesDeCanto(transponer(abreTuJardin, 12))).toEqual(acordesDeCanto(abreTuJardin))
  })

  test('el orden se conserva al transponer: es el mismo acorde en la misma posición', () => {
    // De esto depende que el foco de la barra sobreviva a un cambio de
    // tonalidad: se guarda el índice, no el nombre.
    const original = acordesDeCanto(abreTuJardin)
    for (let n = -11; n <= 11; n++) {
      expect(acordesDeCanto(transponer(abreTuJardin, n))).toHaveLength(original.length)
    }
  })
})
