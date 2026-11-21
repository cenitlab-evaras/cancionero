import { describe, expect, test } from 'vitest'
import { extraerLecturasDeIglesia } from './lecturas-iglesia'
import { CON_SEGUNDA, SIN_SEGUNDA, COMPLEJO, VACIA } from './lecturas-iglesia.fixtures'

describe('extraerLecturasDeIglesia', () => {
  test('un domingo con segunda devuelve cuatro partes', () => {
    const r = extraerLecturasDeIglesia(CON_SEGUNDA)
    expect(r.fecha).toBe('2026-11-22')
    expect(r.complejo).toBe(false)
    expect(r.partes.map((p) => p.tipo)).toEqual(['primera', 'salmo', 'segunda', 'evangelio'])
    expect(r.partes[3].texto).toContain('ACLAMACIÓN AL EVANGELIO')
  })

  test('sin segunda devuelve tres partes', () => {
    expect(extraerLecturasDeIglesia(SIN_SEGUNDA).partes.map((p) => p.tipo)).toEqual([
      'primera', 'salmo', 'evangelio',
    ])
  })

  test('la oración de los fieles no entra en el Evangelio', () => {
    const r = extraerLecturasDeIglesia(CON_SEGUNDA)
    const evangelio = r.partes.find((p) => p.tipo === 'evangelio')
    expect(evangelio).toBeDefined()
    expect(evangelio!.texto).not.toContain('Oración de los fieles')
    expect(evangelio!.texto).not.toContain('oración de los fieles')
  })

  test('varios formularios son complejos y no traen partes', () => {
    const r = extraerLecturasDeIglesia(COMPLEJO)
    expect(r.complejo).toBe(true)
    expect(r.partes).toEqual([])
  })

  test('una página sin lecturas no inventa nada', () => {
    const r = extraerLecturasDeIglesia(VACIA)
    expect(r.fecha).toBeNull()
    expect(r.partes).toEqual([])
    expect(r.complejo).toBe(false)
  })
})
