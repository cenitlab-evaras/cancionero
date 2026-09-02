import { describe, expect, test } from 'vitest'
import { ZONA_DEL_CORO, fechaEnZona } from './fecha'

/**
 * Qué día es "hoy" para el coro — el pendiente que §17.1-octies dejó declarado
 * en H13 y que el despliegue del 2026-09-02 activó.
 *
 * El motor de historial ya recibe `hoy` por parámetro y es puro. El punto sucio
 * era quién calcula ese string: `hoyISO()` usaba la zona del proceso, y el
 * contenedor de producción corre en UTC. Chile está 3 o 4 horas detrás, así que
 * todas las noches, entre las 20:00 y la medianoche, el servidor ya estaba en el
 * día siguiente: una misa agendada para mañana se contaba como ya cantada y
 * todos los "hace N días" salían corridos en uno.
 *
 * Estos tests fijan el comportamiento contra instantes concretos, no contra el
 * reloj: por eso `fechaEnZona` recibe el instante en vez de llamar a `new Date()`.
 */

describe('fechaEnZona', () => {
  test('a las 22:00 en Chile todavía es HOY, aunque en UTC ya sea mañana', () => {
    // 2026-09-03T02:00Z = 2026-09-02 22:00 en Santiago (UTC-4).
    const instante = new Date('2026-09-03T02:00:00Z')
    expect(instante.toISOString().slice(0, 10)).toBe('2026-09-03') // lo que decía UTC
    expect(fechaEnZona(instante)).toBe('2026-09-02') // lo que vive el coro
  })

  test('durante el día las dos zonas coinciden', () => {
    const instante = new Date('2026-09-02T18:00:00Z') // 14:00 en Santiago
    expect(fechaEnZona(instante)).toBe('2026-09-02')
  })

  test('respeta el horario de verano chileno (UTC-3 en enero)', () => {
    // 2026-01-15T02:00Z = 2026-01-14 23:00 en Santiago (UTC-3).
    const instante = new Date('2026-01-15T02:00:00Z')
    expect(fechaEnZona(instante)).toBe('2026-01-14')
  })

  test('a la medianoche pasada en Chile ya es el día nuevo', () => {
    // 2026-09-03T04:30Z = 2026-09-03 00:30 en Santiago.
    const instante = new Date('2026-09-03T04:30:00Z')
    expect(fechaEnZona(instante)).toBe('2026-09-03')
  })

  test('devuelve YYYY-MM-DD, el formato que comparan los motores', () => {
    // El motor compara fechas como strings (`e.fecha <= hoy`): si el formato
    // no fuese ISO, la comparación mentiría sin fallar.
    expect(fechaEnZona(new Date('2026-03-07T12:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  test('la zona es explícita y no depende del reloj del servidor', () => {
    expect(ZONA_DEL_CORO).toBe('America/Santiago')
    // Y se puede pedir otra, para no atar el motor a un solo coro.
    const instante = new Date('2026-09-03T02:00:00Z')
    expect(fechaEnZona(instante, 'UTC')).toBe('2026-09-03')
  })
})
