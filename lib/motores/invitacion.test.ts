import { describe, expect, test } from 'vitest'
import { DIAS_DE_VALIDEZ, estaVencida, normalizarEmail, vencimientoDesde } from './invitacion'

describe('invitación', () => {
  test('normaliza el correo', () => {
    expect(normalizarEmail('  Juan.Perez@Coro.CL ')).toBe('juan.perez@coro.cl')
  })

  test('sabe si una invitación venció', () => {
    expect(estaVencida('2026-11-01T00:00:00Z', new Date('2026-11-02T00:00:00Z'))).toBe(true)
    expect(estaVencida('2026-11-03T00:00:00Z', new Date('2026-11-02T00:00:00Z'))).toBe(false)
  })

  test('el instante exacto del vencimiento ya cuenta como vencido', () => {
    // La RPC acepta con `expira_en > now()`: en el segundo exacto, ya no vale.
    expect(estaVencida('2026-11-02T00:00:00Z', new Date('2026-11-02T00:00:00Z'))).toBe(true)
  })

  test('una invitación nueva vence a los siete días', () => {
    const ahora = new Date('2026-11-02T00:00:00Z')
    expect(DIAS_DE_VALIDEZ).toBe(7)
    expect(vencimientoDesde(ahora)).toBe('2026-11-09T00:00:00.000Z')
  })
})
