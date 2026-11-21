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
