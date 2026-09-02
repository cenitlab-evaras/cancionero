import { describe, expect, test } from 'vitest'
import { agruparCelebraciones } from './agenda'

/**
 * Agrupar las misas por lo que el director pregunta el domingo.
 *
 * La lista venía ordenada por fecha descendente y sin distinguir nada: la misa
 * del 20 de septiembre —que todavía no ocurrió— se veía igual que la del 3 de
 * mayo, y aparecía primero sólo por ser la más lejana en el futuro. Para
 * encontrar «la próxima» había que leer las seis fechas y compararlas de
 * memoria.
 *
 * El criterio de qué ya ocurrió es el MISMO que el del historial (§17): fecha
 * declarada y no futura. Si acá dijéramos otra cosa, el mismo domingo contaría
 * como cantado en una pantalla y como pendiente en la otra.
 */

const misa = (nombre: string, fecha: string | null) => ({ nombre, fecha })

describe('agruparCelebraciones', () => {
  test('lo que viene va primero, y lo más próximo arriba', () => {
    const r = agruparCelebraciones(
      [misa('lejana', '2026-12-25'), misa('próxima', '2026-09-06')],
      '2026-09-02'
    )
    // Ascendente: la próxima es la que hay que preparar.
    expect(r.proximas.map((c) => c.nombre)).toEqual(['próxima', 'lejana'])
  })

  test('lo ya cantado va después, y lo más reciente arriba', () => {
    const r = agruparCelebraciones(
      [misa('vieja', '2026-05-03'), misa('reciente', '2026-08-30')],
      '2026-09-02'
    )
    expect(r.pasadas.map((c) => c.nombre)).toEqual(['reciente', 'vieja'])
  })

  test('la de hoy cuenta como ocurrida, igual que en el historial', () => {
    // §17 decidió «fecha declarada y ya pasada». Si acá la tratáramos como
    // pendiente, el mismo domingo diría dos cosas distintas según la pantalla.
    const r = agruparCelebraciones([misa('la de hoy', '2026-09-02')], '2026-09-02')
    expect(r.pasadas.map((c) => c.nombre)).toEqual(['la de hoy'])
    expect(r.proximas).toEqual([])
  })

  test('las listas sin fecha van aparte, no al fondo de las pasadas', () => {
    // Un ensayo sin fecha no es una misa vieja: no ocurrió ni está agendado.
    const r = agruparCelebraciones(
      [misa('ensayo', null), misa('misa', '2026-08-30')],
      '2026-09-02'
    )
    expect(r.sinFecha.map((c) => c.nombre)).toEqual(['ensayo'])
    expect(r.pasadas.map((c) => c.nombre)).toEqual(['misa'])
  })

  test('reparte los tres grupos sin perder ni repetir ninguna', () => {
    const lista = [
      misa('a', '2026-12-25'),
      misa('b', '2026-09-06'),
      misa('c', '2026-09-02'),
      misa('d', '2026-05-03'),
      misa('e', null),
    ]
    const r = agruparCelebraciones(lista, '2026-09-02')
    const total = [...r.proximas, ...r.pasadas, ...r.sinFecha]
    expect(total).toHaveLength(lista.length)
    expect(new Set(total.map((c) => c.nombre)).size).toBe(lista.length)
  })

  test('no muta la lista que recibe', () => {
    const lista = [misa('a', '2026-05-03'), misa('b', '2026-12-25')]
    agruparCelebraciones(lista, '2026-09-02')
    expect(lista.map((c) => c.nombre)).toEqual(['a', 'b'])
  })

  test('una lista vacía devuelve los tres grupos vacíos, no undefined', () => {
    const r = agruparCelebraciones([], '2026-09-02')
    expect(r).toEqual({ proximas: [], pasadas: [], sinFecha: [] })
  })
})
