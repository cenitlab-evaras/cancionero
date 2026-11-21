import { describe, expect, test } from 'vitest'
import { repartirLecturas } from './lecturas'

const pegado = `PRIMERA LECTURA
Lectura del libro de Isaías 55, 1-11
Esto dice el Señor: vengan a mí.
Palabra de Dios.

SALMO RESPONSORIAL 144, 8-9
R. El Señor es compasivo y misericordioso.
SEGUNDA LECTURA
Lectura de la primera carta del Apóstol san Pablo a los Romanos 8, 35-39
¿Quién nos separará del amor de Cristo?
Palabra de Dios.

EVANGELIO
Lectura del santo Evangelio según san Mateo 14, 13-21
Jesús tomó los panes y los repartió.
Palabra de Dios.`

describe('repartirLecturas', () => {
  test('reparte las cuatro partes y sus referencias', () => {
    const r = repartirLecturas(pegado)
    expect(r.reconocido).toBe(true)
    expect(r.partes.map((p) => p.tipo)).toEqual(['primera', 'salmo', 'segunda', 'evangelio'])
    expect(r.partes[0].referencia).toBe('Isaías 55, 1-11')
    expect(r.partes[1].referencia).toBe('144, 8-9')
    expect(r.partes[3].texto).toContain('Jesús tomó los panes')
  })

  test('sin encabezados conserva todo el texto en la primera parte', () => {
    const r = repartirLecturas('Un texto cualquiera sin encabezados.')
    expect(r.reconocido).toBe(false)
    expect(r.partes).toHaveLength(1)
    expect(r.partes[0]).toMatchObject({ tipo: 'primera', texto: 'Un texto cualquiera sin encabezados.' })
  })

  test('el texto vacío no inventa partes', () => {
    expect(repartirLecturas('   ').partes).toEqual([])
  })
})
