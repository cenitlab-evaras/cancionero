import { describe, expect, test } from 'vitest'
import { diasConMisa, marcasDeDia } from './calendario'

/**
 * El calendario de misas — H31, docs/PRD.md §17.
 *
 * El motor no consulta nada ni lee el reloj: recibe las misas y el mes, y
 * devuelve qué días tienen misa. Así la grilla puede pintar el mes entero sin
 * que la pantalla reimplemente el filtro por fecha.
 */
describe('diasConMisa', () => {
  test('agrupa las misas del mes y descarta las de otros meses y sin fecha', () => {
    const dias = diasConMisa(
      [
        { fecha: '2026-11-22' },
        { fecha: '2026-11-01' },
        { fecha: '2026-12-01' },
        { fecha: null },
      ],
      { anio: 2026, mes: 10 }
    )
    expect([...dias].sort()).toEqual(['2026-11-01', '2026-11-22'])
  })

  test('las marcas reflejan lecturas y propuestas', () => {
    expect(marcasDeDia(0, 0)).toEqual({ libro: false, punto: false })
    expect(marcasDeDia(4, 0)).toEqual({ libro: true, punto: false })
    expect(marcasDeDia(0, 2)).toEqual({ libro: false, punto: true })
    expect(marcasDeDia(4, 2)).toEqual({ libro: true, punto: true })
  })
})
