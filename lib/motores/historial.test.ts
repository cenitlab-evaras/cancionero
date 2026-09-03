import { describe, expect, test } from 'vitest'
import {
  type EjecucionCruda,
  historialDeCanto,
  ordenarPorUso,
  resumirHistorial,
  describirAntiguedad,
  describirEspaciado,
} from './historial'

/**
 * H13 · Historial y métricas por canto — el "listo cuando" de §17, y B1 A+B.
 *
 * La regla que manda, decidida el 2026-08-07: **cuenta lo que ya ocurrió.**
 * Una misa con fecha futura está agendada, no cantada; una sin fecha
 * —el ensayo de §18-6— nunca ocurrió en una misa. Las dos quedan fuera.
 *
 * `hoy` entra por parámetro y no sale de `new Date()`: un motor que mira el
 * reloj no se puede probar, y "hace cuánto" cambiaría de respuesta según el día
 * en que corran los tests.
 */

const HOY = '2026-08-07'

const ej = (cantoId: string, fecha: string | null, momento = 'Entrada'): EjecucionCruda => ({
  cantoId,
  misaId: `misa-${fecha ?? 'sin-fecha'}-${cantoId}`,
  misaNombre: `Misa del ${fecha ?? '—'}`,
  fecha,
  momento,
})

describe('historialDeCanto · qué cuenta', () => {
  test('cuenta las misas pasadas, la más reciente primero', () => {
    const h = historialDeCanto(
      [ej('a', '2026-05-03'), ej('a', '2026-07-12'), ej('a', '2026-06-07')],
      HOY
    )
    expect(h.veces).toBe(3)
    expect(h.ejecuciones.map((e) => e.fecha)).toEqual(['2026-07-12', '2026-06-07', '2026-05-03'])
  })

  test('una misa con fecha FUTURA no cuenta: está agendada, no cantada', () => {
    const h = historialDeCanto([ej('a', '2026-07-12'), ej('a', '2026-09-20')], HOY)
    expect(h.veces).toBe(1)
    expect(h.ultima).toBe('2026-07-12')
  })

  test('una lista SIN fecha no cuenta: nunca ocurrió en una misa', () => {
    const h = historialDeCanto([ej('a', '2026-07-12'), ej('a', null)], HOY)
    expect(h.veces).toBe(1)
  })

  test('la misa de HOY sí cuenta: ya es el día', () => {
    // El corte es "no futura", no "estrictamente anterior": si el coro canta
    // hoy y el director abre la app después de misa, tiene que verlo.
    expect(historialDeCanto([ej('a', HOY)], HOY).veces).toBe(1)
  })

  test('un canto que nunca se cantó no es un cero disfrazado', () => {
    const h = historialDeCanto([], HOY)
    expect(h.veces).toBe(0)
    expect(h.ultima).toBe(null)
    expect(h.diasDesdeUltima).toBe(null)
    expect(h.cadaCuantosDias).toBe(null)
  })
})

describe('historialDeCanto · las métricas', () => {
  test('«hace cuánto» se mide contra `hoy`, en días', () => {
    expect(historialDeCanto([ej('a', '2026-07-31')], HOY).diasDesdeUltima).toBe(7)
    expect(historialDeCanto([ej('a', HOY)], HOY).diasDesdeUltima).toBe(0)
  })

  test('el espaciado es el promedio de días ENTRE ejecuciones', () => {
    // 3 de mayo → 7 de junio (35 días) → 12 de julio (35 días) = 35 de promedio.
    const h = historialDeCanto(
      [ej('a', '2026-05-03'), ej('a', '2026-06-07'), ej('a', '2026-07-12')],
      HOY
    )
    expect(h.cadaCuantosDias).toBe(35)
  })

  test('con una sola vez no hay espaciado que promediar, y eso es null y no 0', () => {
    // Un 0 se leería como "se canta todos los días", que es lo contrario.
    expect(historialDeCanto([ej('a', '2026-07-12')], HOY).cadaCuantosDias).toBe(null)
  })

  test('agrupa en qué momento de la misa se cantó, del más frecuente al menos', () => {
    const h = historialDeCanto(
      [
        ej('a', '2026-05-03', 'Comunión'),
        ej('a', '2026-06-07', 'Entrada'),
        ej('a', '2026-07-12', 'Entrada'),
      ],
      HOY
    )
    expect(h.porMomento).toEqual([
      { momento: 'Entrada', veces: 2 },
      { momento: 'Comunión', veces: 1 },
    ])
  })
})

describe('resumirHistorial · el repertorio entero de una pasada', () => {
  const CRUDO = [
    ej('a', '2026-07-12'),
    ej('a', '2026-06-07'),
    ej('b', '2026-07-12'),
    ej('c', '2026-09-20'), // futura: no cuenta
  ]

  test('devuelve un historial por canto, indexado por id', () => {
    const r = resumirHistorial(CRUDO, HOY)
    expect(r.get('a')?.veces).toBe(2)
    expect(r.get('b')?.veces).toBe(1)
    // 'c' aparece, pero con cero: su única misa todavía no ocurrió.
    expect(r.get('c')?.veces).toBe(0)
  })
})

describe('ordenarPorUso · la pantalla /historial', () => {
  const canto = (id: string, titulo: string, veces: number, ultima: string | null) => ({
    id,
    titulo,
    historial: historialDeCanto(
      Array.from({ length: veces }, (_, i) =>
        ej(id, i === 0 && ultima ? ultima : `2026-0${(i % 4) + 1}-01`)
      ),
      HOY
    ),
  })

  test('ordena de más a menos cantado', () => {
    const lista = [canto('a', 'Uno', 1, '2026-07-12'), canto('b', 'Dos', 3, '2026-07-12')]
    expect(ordenarPorUso(lista).map((c) => c.titulo)).toEqual(['Dos', 'Uno'])
  })

  test('a igual cantidad, primero el cantado más recientemente', () => {
    const lista = [canto('a', 'Viejo', 1, '2026-01-10'), canto('b', 'Nuevo', 1, '2026-07-12')]
    expect(ordenarPorUso(lista).map((c) => c.titulo)).toEqual(['Nuevo', 'Viejo'])
  })

  test('los que nunca se cantaron van al final, pero JUNTOS y ordenados por título', () => {
    // Van al final porque la pregunta de la pantalla es "qué usamos"; van
    // juntos y alfabéticos porque la segunda pregunta —"qué estamos dejando
    // morir"— se contesta leyendo justo ese bloque.
    const lista = [
      canto('z', 'Zeta', 0, null),
      canto('a', 'Alfa', 0, null),
      canto('m', 'Medio', 2, '2026-07-12'),
    ]
    expect(ordenarPorUso(lista).map((c) => c.titulo)).toEqual(['Medio', 'Alfa', 'Zeta'])
  })
})

describe('describirAntiguedad · los días en palabras', () => {
  test('el día mismo y el anterior tienen su propia palabra', () => {
    expect(describirAntiguedad(0)).toBe('hoy')
    expect(describirAntiguedad(1)).toBe('ayer')
  })

  test('hasta la semana, en días', () => {
    expect(describirAntiguedad(2)).toBe('hace 2 días')
    expect(describirAntiguedad(6)).toBe('hace 6 días')
  })

  test('de una semana a un mes, en semanas', () => {
    expect(describirAntiguedad(7)).toBe('hace 1 semana')
    expect(describirAntiguedad(13)).toBe('hace 1 semana')
    expect(describirAntiguedad(14)).toBe('hace 2 semanas')
    expect(describirAntiguedad(29)).toBe('hace 4 semanas')
  })

  test('de un mes a un año, en meses', () => {
    expect(describirAntiguedad(30)).toBe('hace 1 mes')
    expect(describirAntiguedad(75)).toBe('hace 2 meses')
    expect(describirAntiguedad(364)).toBe('hace 12 meses')
  })

  test('más de un año, en años', () => {
    expect(describirAntiguedad(365)).toBe('hace 1 año')
    expect(describirAntiguedad(800)).toBe('hace 2 años')
  })

  test('nunca cantado no es "hace null días"', () => {
    // El caso que rompe la pantalla si el motor devuelve un número igual.
    expect(describirAntiguedad(null)).toBe('nunca')
  })
})

describe('describirEspaciado · cada cuánto vuelve', () => {
  test('lo dice en la unidad que se entiende de un vistazo', () => {
    expect(describirEspaciado(7)).toBe('cada semana')
    expect(describirEspaciado(35)).toBe('cada 5 semanas')
    expect(describirEspaciado(3)).toBe('cada 3 días')
    expect(describirEspaciado(120)).toBe('cada 4 meses')
  })

  test('con una sola ejecución no hay ritmo que declarar', () => {
    expect(describirEspaciado(null)).toBe(null)
  })
})

describe('lo agendado se distingue de lo cantado, no se esconde', () => {
  test('una misa futura no suma veces, pero SÍ se informa aparte', () => {
    // Sin esto, el director que armó la misa del domingo abre el canto, lee
    // «nunca se cantó» y concluye que la app perdió su trabajo.
    const h = historialDeCanto([ej('a', '2026-07-12'), ej('a', '2026-09-20')], HOY)
    expect(h.veces).toBe(1)
    expect(h.agendadas.map((e) => e.fecha)).toEqual(['2026-09-20'])
  })

  test('las agendadas van de la más próxima a la más lejana', () => {
    const h = historialDeCanto([ej('a', '2026-11-01'), ej('a', '2026-09-20')], HOY)
    expect(h.agendadas.map((e) => e.fecha)).toEqual(['2026-09-20', '2026-11-01'])
  })

  test('una lista sin fecha no es una agendada: no tiene cuándo', () => {
    const h = historialDeCanto([ej('a', null)], HOY)
    expect(h.veces).toBe(0)
    expect(h.agendadas).toEqual([])
  })
})
