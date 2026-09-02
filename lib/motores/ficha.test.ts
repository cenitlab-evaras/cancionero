import { describe, expect, test } from 'vitest'
import {
  DISPONIBILIDADES,
  TESITURAS,
  edadEn,
  esDisponibilidadValida,
  esMenorDeEdad,
  esTesituraValida,
  etiquetaDisponibilidad,
  etiquetaTesitura,
  ordenarPorTesitura,
} from './ficha'

/**
 * H14 · Ficha del miembro — el "listo cuando" de §17.
 *
 * Lo que este motor existe para garantizar:
 *
 *  1. **La edad se calcula, nunca se guarda.** Es el innegociable de cero
 *     derivados persistidos, y además una edad guardada envejece mal.
 *  2. **El cumpleaños que todavía no llegó descuenta un año.** Restar años a
 *     secas es el bug clásico de este cálculo, y acá tiene consecuencia real:
 *     en contexto parroquial, quién es menor de edad no es un detalle.
 *  3. **Un valor desconocido nunca se trata como tesitura ni disponibilidad.**
 *     Entran por POST y no son confiables; la base tiene su `check`, pero la
 *     pantalla no debería llegar a intentarlo.
 *  4. **La etiqueta se escribe UNA vez**: /mi-ficha y /coro/miembros tienen que
 *     decir exactamente lo mismo.
 */

describe('edadEn', () => {
  test('cuando el cumpleaños de este año ya pasó', () => {
    expect(edadEn('1990-03-15', '2026-09-02')).toBe(36)
  })

  test('cuando el cumpleaños de este año TODAVÍA no llegó, es un año menos', () => {
    // El bug clásico: 2026 - 1990 = 36, pero todavía tiene 35.
    expect(edadEn('1990-12-15', '2026-09-02')).toBe(35)
  })

  test('el día exacto del cumpleaños ya cuenta el año', () => {
    expect(edadEn('1990-09-02', '2026-09-02')).toBe(36)
  })

  test('el día anterior al cumpleaños todavía no', () => {
    expect(edadEn('1990-09-03', '2026-09-02')).toBe(35)
  })

  test('un nacido el 29 de febrero no rompe en un año no bisiesto', () => {
    // Cumple el 29/2; en 2026 (no bisiesto) al 1 de marzo ya cumplió.
    expect(edadEn('2000-02-29', '2026-03-01')).toBe(26)
    expect(edadEn('2000-02-29', '2026-02-28')).toBe(25)
  })

  test('sin fecha de nacimiento no hay edad, y eso no es un cero', () => {
    // Un 0 en la pantalla diría "recién nacido". La ficha es opcional.
    expect(edadEn(null, '2026-09-02')).toBeNull()
  })
})

describe('esMenorDeEdad', () => {
  test('lo es quien todavía no cumplió 18', () => {
    expect(esMenorDeEdad('2009-09-03', '2026-09-02')).toBe(true)
  })

  test('deja de serlo el día que los cumple', () => {
    expect(esMenorDeEdad('2008-09-02', '2026-09-02')).toBe(false)
  })

  test('sin fecha no se afirma nada: null, no false', () => {
    // Decir "no es menor" de alguien de quien no sabemos la edad sería inventar.
    expect(esMenorDeEdad(null, '2026-09-02')).toBeNull()
  })
})

describe('esTesituraValida', () => {
  test('acepta las seis del dominio', () => {
    for (const t of TESITURAS) expect(esTesituraValida(t)).toBe(true)
  })

  test('rechaza lo que no está en el catálogo', () => {
    expect(esTesituraValida('contratenor')).toBe(false)
    expect(esTesituraValida('')).toBe(false)
    expect(esTesituraValida(null)).toBe(false)
    expect(esTesituraValida('SOPRANO')).toBe(false)
  })
})

describe('esDisponibilidadValida', () => {
  test('acepta los tres niveles', () => {
    for (const d of DISPONIBILIDADES) expect(esDisponibilidadValida(d)).toBe(true)
  })

  test('rechaza un número: la escala es nombrada a propósito', () => {
    expect(esDisponibilidadValida('3')).toBe(false)
    expect(esDisponibilidadValida(null)).toBe(false)
  })
})

describe('etiquetas', () => {
  test('cada tesitura se lee en castellano', () => {
    expect(etiquetaTesitura('mezzosoprano')).toBe('Mezzosoprano')
    expect(etiquetaTesitura('baritono')).toBe('Barítono')
  })

  test('la disponibilidad se lee como la diría una persona', () => {
    expect(etiquetaDisponibilidad('casi_siempre')).toBe('Casi siempre')
    expect(etiquetaDisponibilidad('rara_vez')).toBe('Rara vez')
  })

  test('un valor sin cargar se dice, no se deja en blanco', () => {
    expect(etiquetaTesitura(null)).toBe('Sin declarar')
    expect(etiquetaDisponibilidad(null)).toBe('Sin declarar')
  })
})

describe('ordenarPorTesitura', () => {
  test('ordena de voz aguda a grave, como se lista un coro', () => {
    const gente = [
      { nombre: 'Ana', tesitura: 'bajo' },
      { nombre: 'Beto', tesitura: 'soprano' },
      { nombre: 'Caro', tesitura: 'tenor' },
    ]
    expect(ordenarPorTesitura(gente).map((p) => p.nombre)).toEqual(['Beto', 'Caro', 'Ana'])
  })

  test('quien no declaró tesitura va al final, no primero', () => {
    const gente = [
      { nombre: 'Ana', tesitura: null },
      { nombre: 'Beto', tesitura: 'contralto' },
    ]
    expect(ordenarPorTesitura(gente).map((p) => p.nombre)).toEqual(['Beto', 'Ana'])
  })

  test('no muta el arreglo que recibe', () => {
    const gente = [{ nombre: 'Ana', tesitura: 'bajo' }, { nombre: 'Beto', tesitura: 'soprano' }]
    ordenarPorTesitura(gente)
    expect(gente[0].nombre).toBe('Ana')
  })
})
