import { describe, expect, test } from 'vitest'
import { iniciales } from './iniciales'

/** Las iniciales de quien se anotó a una misa (2026-10-17). */
describe('iniciales', () => {
  test('nombre y apellido', () => {
    expect(iniciales('María Pérez', 'm@x.cl')).toBe('MP')
  })
  test('con partículas: se saltan', () => {
    expect(iniciales('José de la Fuente', null)).toBe('JF')
  })
  test('un solo nombre: sus dos primeras letras', () => {
    expect(iniciales('Ana', null)).toBe('AN')
  })
  test('sin nombre, del correo', () => {
    expect(iniciales(null, 'director@cantoral.local')).toBe('DI')
    expect(iniciales('  ', 'juan.soto@x.cl')).toBe('JS')
  })
  test('nada: un signo, no un hueco', () => {
    expect(iniciales(null, null)).toBe('?')
  })
})
