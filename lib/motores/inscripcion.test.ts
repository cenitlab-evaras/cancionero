import { describe, expect, test } from 'vitest'
import {
  APORTES,
  contarInstrumento,
  contarVoces,
  INSTRUMENTOS,
  quienFalta,
  resumirCoro,
  sePuedeInscribir,
  validarInscripcion,
} from './inscripcion'

/**
 * H15 · Inscripción a la misa — el "listo cuando" de §17, y B2 de §19.2.
 *
 * Lo que este motor tiene que garantizar:
 *
 *  1. **El aporte es condicional, no dos campos sueltos** (B2): quien toca dice
 *     qué toca, y quien canta no arrastra un instrumento fantasma. La base ya lo
 *     impide con un `check`; acá vive el motivo que se le muestra a la persona.
 *  2. **La tesitura NO se pide al inscribirse**: sale del perfil de H14. Pedirla
 *     dos veces es crear dos verdades que algún día se contradicen.
 *  3. **La inscripción manda sobre la disponibilidad** (§18-11, que B2 dejó
 *     abierto): en cuanto alguien se anota, deja de mostrarse su predicción. No
 *     compiten nunca, porque nunca hablan de la misma persona a la vez.
 */

const anotado = (perfilId: string, aporte: 'vocal' | 'instrumental', instrumento: string | null = null) => ({
  perfilId,
  nombre: perfilId,
  aporte,
  instrumento,
})

describe('validarInscripcion', () => {
  test('cantar no lleva instrumento', () => {
    const r = validarInscripcion({ aporte: 'vocal', instrumento: null })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.limpio).toEqual({ aporte: 'vocal', instrumento: null })
  })

  test('tocar exige decir QUÉ se toca — es la mitad del pedido de B2', () => {
    const r = validarInscripcion({ aporte: 'instrumental', instrumento: null })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/instrumento/i)
  })

  test('cantar con un instrumento cargado no se guarda a medias: se limpia', () => {
    // El caso real: alguien elige «toco · guitarra», cambia de idea y marca
    // «canto». Si el instrumento viajara igual, la fila diría que canta con
    // guitarra y el `check` de la base rechazaría el guardado sin explicar nada.
    const r = validarInscripcion({ aporte: 'vocal', instrumento: 'guitarra' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.limpio.instrumento).toBe(null)
  })

  test('un instrumento que no está en la lista se rechaza', () => {
    const r = validarInscripcion({ aporte: 'instrumental', instrumento: 'theremin' })
    expect(r.ok).toBe(false)
  })

  test('un aporte inventado se rechaza: la entrada llega por POST', () => {
    const r = validarInscripcion({ aporte: 'director', instrumento: null })
    expect(r.ok).toBe(false)
  })

  test('los dos aportes y todos los instrumentos de la lista pasan', () => {
    for (const instrumento of INSTRUMENTOS) {
      expect(validarInscripcion({ aporte: 'instrumental', instrumento }).ok).toBe(true)
    }
    for (const aporte of APORTES) {
      const instrumento = aporte === 'instrumental' ? 'guitarra' : null
      expect(validarInscripcion({ aporte, instrumento }).ok).toBe(true)
    }
  })
})

describe('resumirCoro', () => {
  const fichas = [
    { perfilId: 'ana', tesitura: 'contralto', disponibilidad: 'casi_siempre' },
    { perfilId: 'juan', tesitura: 'tenor', disponibilidad: 'a_veces' },
    { perfilId: 'maria', tesitura: 'soprano', disponibilidad: null },
  ]

  test('cuenta las voces por tesitura, leyéndola del perfil y no de la inscripción', () => {
    const r = resumirCoro([anotado('ana', 'vocal'), anotado('maria', 'vocal')], fichas)
    expect(r.total).toBe(2)
    expect(r.voces).toEqual([
      { tesitura: 'soprano', cuantos: 1 },
      { tesitura: 'contralto', cuantos: 1 },
    ])
  })

  test('las voces salen de aguda a grave, no en el orden en que se anotaron', () => {
    const r = resumirCoro(
      [anotado('juan', 'vocal'), anotado('ana', 'vocal'), anotado('maria', 'vocal')],
      fichas
    )
    expect(r.voces.map((v) => v.tesitura)).toEqual(['soprano', 'contralto', 'tenor'])
  })

  test('quien canta sin tesitura declarada suma igual, con la tesitura en null', () => {
    // Media ficha es mejor que ninguna (H14): no se lo puede dejar afuera del
    // conteo solo porque no eligió su voz.
    const r = resumirCoro([anotado('pedro', 'vocal')], fichas)
    expect(r.total).toBe(1)
    expect(r.voces).toEqual([{ tesitura: null, cuantos: 1 }])
  })

  test('agrupa los instrumentos y cuenta las repeticiones', () => {
    const r = resumirCoro(
      [
        anotado('ana', 'instrumental', 'guitarra'),
        anotado('juan', 'instrumental', 'guitarra'),
        anotado('maria', 'instrumental', 'teclado'),
      ],
      fichas
    )
    expect(r.total).toBe(3)
    expect(r.voces).toEqual([])
    expect(r.instrumentos).toEqual([
      { instrumento: 'guitarra', cuantos: 2 },
      { instrumento: 'teclado', cuantos: 1 },
    ])
  })

  test('quien toca NO se cuenta como voz, aunque tenga tesitura en su perfil', () => {
    // Ana es contralto, pero esta misa va con la guitarra. El resumen tiene que
    // decir con qué se cuenta el domingo, no qué sabe hacer la gente.
    const r = resumirCoro([anotado('ana', 'instrumental', 'guitarra')], fichas)
    expect(r.voces).toEqual([])
    expect(r.instrumentos).toEqual([{ instrumento: 'guitarra', cuantos: 1 }])
  })

  test('sin nadie anotado devuelve ceros y listas vacías, no null', () => {
    const r = resumirCoro([], fichas)
    expect(r).toEqual({ total: 0, voces: [], instrumentos: [] })
  })
})

describe('quienFalta', () => {
  const miembros = [
    { perfilId: 'ana', nombre: 'Ana' },
    { perfilId: 'juan', nombre: 'Juan' },
    { perfilId: 'luis', nombre: 'Luis' },
  ]
  const fichas = [
    { perfilId: 'ana', tesitura: 'contralto', disponibilidad: 'casi_siempre' },
    { perfilId: 'luis', tesitura: null, disponibilidad: 'rara_vez' },
  ]

  test('lista solo a quien todavía no dijo nada', () => {
    const r = quienFalta(miembros, [anotado('ana', 'vocal')], fichas)
    expect(r.map((p) => p.perfilId)).toEqual(['juan', 'luis'])
  })

  test('LA INSCRIPCIÓN MANDA: al anotarse, su disponibilidad deja de mostrarse', () => {
    // §18-11, la tensión que B2 dejó abierta. Luis «rara vez» puede, pero dijo
    // que va: la predicción ya no tiene nada que aportar sobre él.
    const antes = quienFalta(miembros, [], fichas)
    expect(antes.map((p) => p.perfilId)).toContain('luis')

    const despues = quienFalta(miembros, [anotado('luis', 'instrumental', 'bajo')], fichas)
    expect(despues.map((p) => p.perfilId)).not.toContain('luis')
  })

  test('trae la disponibilidad del perfil, y `null` para quien no cargó el suyo', () => {
    const r = quienFalta(miembros, [], fichas)
    expect(r).toEqual([
      { perfilId: 'ana', nombre: 'Ana', disponibilidad: 'casi_siempre' },
      { perfilId: 'juan', nombre: 'Juan', disponibilidad: null },
      { perfilId: 'luis', nombre: 'Luis', disponibilidad: 'rara_vez' },
    ])
  })

  test('alguien inscrito que ya no es del coro no rompe ni aparece', () => {
    // Pasa de verdad: el director saca a alguien del coro después de que se
    // anotó. Su fila queda hasta que se borre, y esta lista no puede caerse.
    const r = quienFalta(miembros, [anotado('fantasma', 'vocal')], fichas)
    expect(r.map((p) => p.perfilId)).toEqual(['ana', 'juan', 'luis'])
  })

  test('con todo el coro anotado no falta nadie', () => {
    const todos = miembros.map((m) => anotado(m.perfilId, 'vocal'))
    expect(quienFalta(miembros, todos, fichas)).toEqual([])
  })
})

describe('sePuedeInscribir', () => {
  test('una misa futura se puede', () => {
    expect(sePuedeInscribir('2026-09-20', '2026-09-03')).toBe(true)
  })

  test('LA MISA DE HOY TAMBIÉN, y acá el criterio se separa del historial', () => {
    // `agruparMisas` y el historial cuentan hoy como YA OCURRIDO, porque
    // preguntan «¿se cantó?». Esto pregunta otra cosa: «¿todavía puedo decir
    // que voy?». El domingo a las nueve de la mañana la respuesta es sí, y
    // cerrarlo a medianoche dejaría afuera justo a quien decide ese día.
    expect(sePuedeInscribir('2026-09-03', '2026-09-03')).toBe(true)
  })

  test('una misa que ya pasó no', () => {
    expect(sePuedeInscribir('2026-09-02', '2026-09-03')).toBe(false)
  })

  test('una lista sin fecha se puede: no venció nunca', () => {
    expect(sePuedeInscribir(null, '2026-09-03')).toBe(true)
  })
})

describe('contarVoces y contarInstrumento', () => {
  test('concuerdan en singular y en plural', () => {
    expect(contarVoces('tenor', 1)).toBe('1 tenor')
    expect(contarInstrumento('guitarra', 1)).toBe('1 guitarra')
  })

  test('los plurales irregulares no se sacan con una regla', () => {
    // «tenor» → «tenores» y «violín» → «violines». Agregar una «s» daría
    // «tenors» y «violíns», que es exactamente el error que una regla comete y
    // un mapa explícito no.
    expect(contarVoces('tenor', 3)).toBe('3 tenores')
    expect(contarInstrumento('violin', 2)).toBe('2 violines')
    expect(contarInstrumento('percusion', 2)).toBe('2 percusiones')
  })

  test('los regulares también, y con su acento', () => {
    expect(contarVoces('soprano', 2)).toBe('2 sopranos')
    expect(contarVoces('baritono', 2)).toBe('2 barítonos')
    expect(contarInstrumento('teclado', 2)).toBe('2 teclados')
  })

  test('sin tesitura declarada se dice qué HACE, no qué es', () => {
    // No se puede decir «1 sin declarar»: lo que el director necesita saber es
    // que hay alguien cantando, no que a esa persona le falta el perfil.
    expect(contarVoces(null, 1)).toBe('1 canta')
    expect(contarVoces(null, 4)).toBe('4 cantan')
  })

  test('un instrumento desconocido no rompe la frase', () => {
    expect(contarInstrumento('theremin', 1)).toBe('1 theremin')
  })
})
