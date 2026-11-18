import { describe, expect, it } from 'vitest'
import { franjasDeVelos } from './velos'

/**
 * La invariante que pidió el ensayo: los velos (la franja blanca que apaga un
 * pentagrama) nunca pueden tener alto negativo. Pasó en producción local: el
 * `g.system` de Verovio repite los pentagramas (6 × 3) y la "mitad entre
 * vecinos" cerraba hacia arriba, escupiendo `<rect height="-3600">` en consola
 * en cada preparación de la hoja.
 */

const U = 68 // el espacio de pentagrama de MuseScore
// `unidad` es la escala del pentagrama respecto del de MuseScore: 1 en la hoja
// de MuseScore, y el cociente medido en la de Verovio.
const UNIDAD = 1

/** Las cinco líneas de un pentagrama que empieza en `arriba` (espaciado 68). */
function pentagrama(arriba: number, lineas = 5): { ys: number[] } {
  return { ys: Array.from({ length: lineas }, (_, i) => arriba + i * U) }
}

describe('franjasDeVelos', () => {
  it('un sistema normal: primera franja, mitades entre vecinos y última franja', () => {
    const franjas = franjasDeVelos([pentagrama(1000), pentagrama(2000)], UNIDAD)
    expect(franjas).toHaveLength(2)
    // Primera: 450 unidades por encima del pentagrama.
    expect(franjas[0].y0).toBe(1000 - 450)
    // El corte entre las dos es la mitad del hueco, más 150.
    expect(franjas[0].y1).toBe((1000 + 4 * U + 2000) / 2 + 150)
    expect(franjas[1].y0).toBe(franjas[0].y1)
    // La última se extiende 650 por debajo.
    expect(franjas[1].y1).toBe(2000 + 4 * U + 650)
  })

  it('nunca da alto negativo aunque el sistema repita los pentagramas (Verovio 6 × 3)', () => {
    // Es lo que manda Verovio: las seis cuerdas, tres veces, y la secuencia
    // vuelve arriba: 1343, 3143, … 10524, 1343, …
    const arribas = [1343, 3143, 4943, 6743, 8543, 10524]
    const repetidos = [...arribas, ...arribas, ...arribas].map((y) => pentagrama(y))
    const franjas = franjasDeVelos(repetidos, UNIDAD)
    // Seis pentagramas, no dieciocho: el repetido es el mismo.
    expect(franjas).toHaveLength(6)
    for (const f of franjas) expect(f.y1).toBeGreaterThan(f.y0)
    // Y quedan de arriba abajo.
    for (let i = 1; i < franjas.length; i++) expect(franjas[i].y0).toBeGreaterThan(franjas[i - 1].y0)
  })

  it('ordena las líneas de cada pentagrama aunque lleguen desordenadas', () => {
    const revuelto = { ys: [1000 + 4 * U, 1000, 1000 + 2 * U, 1000 + U, 1000 + 3 * U] }
    const franjas = franjasDeVelos([revuelto], UNIDAD)
    expect(franjas[0].y0).toBe(1000 - 450)
    expect(franjas[0].y1).toBe(1000 + 4 * U + 650)
  })

  it('un pentagrama suelto se lleva la franja completa (450 arriba, 650 abajo)', () => {
    const franjas = franjasDeVelos([pentagrama(500)], UNIDAD)
    expect(franjas).toEqual([{ y0: 500 - 450, y1: 500 + 4 * U + 650 }])
  })

  it('descarta pentagramas sin líneas utilizables en vez de dibujar un rect inválido', () => {
    const franjas = franjasDeVelos([{ ys: [] }, { ys: [Number.NaN] }, pentagrama(1000)], UNIDAD)
    expect(franjas).toEqual([{ y0: 1000 - 450, y1: 1000 + 4 * U + 650 }])
  })

  it('con dos pentagramas que comparten la misma altura (duplicado exacto), deja uno', () => {
    const franjas = franjasDeVelos([pentagrama(1000), pentagrama(1000), pentagrama(2000)], UNIDAD)
    expect(franjas).toHaveLength(2)
    for (const f of franjas) expect(f.y1).toBeGreaterThan(f.y0)
  })
})
