import { describe, expect, test } from 'vitest'
import { paraRepasar, pendientesDelDirector, siguientesMisas } from './inicio'
import type { Inscrito } from './inscripcion'

/**
 * El Inicio como tablero (2026-10-17, el dueño: «hazlo»). Qué tiene que saber
 * cada uno al abrir la app antes de la misa; la pantalla solo pinta esto.
 */

const misa = (id: string, fecha: string | null, cantidadCantos = 5) => ({
  id,
  nombre: `Misa ${id}`,
  fecha,
  cantidadCantos,
})

const canta = (perfilId: string): Inscrito => ({ perfilId, nombre: perfilId, aporte: 'vocal', instrumento: null })
const toca = (perfilId: string, instrumento: string): Inscrito => ({
  perfilId,
  nombre: perfilId,
  aporte: 'instrumental',
  instrumento,
})

const base = {
  misa: misa('a', '2026-10-18'),
  inscritos: [canta('ana'), toca('beto', 'guitarra')],
  faltan: 0,
  pedidos: 0,
  propuestas: 0,
  otras: [],
}

describe('pendientesDelDirector', () => {
  test('con todo en orden no hay nada que resolver', () => {
    expect(pendientesDelDirector(base)).toEqual([])
  })

  test('una misa sin cantos es lo primero, y lleva a armarla', () => {
    const p = pendientesDelDirector({ ...base, misa: misa('a', '2026-10-18', 0), faltan: 3 })
    expect(p[0]).toEqual({
      clave: 'sin-cantos',
      texto: 'La misa todavía no tiene cantos',
      href: '/misas/a/editar',
    })
  })

  test('nadie anotado a tocar se avisa; con alguien tocando, no', () => {
    const sinMusicos = pendientesDelDirector({ ...base, inscritos: [canta('ana')] })
    expect(sinMusicos.map((p) => p.texto)).toEqual(['Nadie se anotó a tocar todavía'])
    expect(sinMusicos[0].href).toBe('/misas/a')
    expect(pendientesDelDirector(base)).toEqual([])
  })

  test('cuántos del coro no han dicho si van, en singular y plural', () => {
    expect(pendientesDelDirector({ ...base, faltan: 1 })[0].texto).toBe('1 persona del coro no ha dicho si va')
    expect(pendientesDelDirector({ ...base, faltan: 7 })[0].texto).toBe('7 personas del coro no han dicho si van')
  })

  test('los pedidos para la misa llevan a la misa; las propuestas, a Sugerencias', () => {
    const p = pendientesDelDirector({ ...base, pedidos: 2, propuestas: 1 })
    expect(p).toEqual([
      { clave: 'pedidos', texto: '2 pedidos de cantos para esta misa', href: '/misas/a' },
      { clave: 'propuestas', texto: '1 canto propuesto para el repertorio', href: '/sugerencias' },
    ])
  })

  test('las próximas misas sin cantos, con su día y hasta dos', () => {
    const otras = [misa('b', '2026-10-25', 0), misa('c', '2026-11-01', 4), misa('d', '2026-11-08', 0), misa('e', '2026-11-15', 0)]
    const p = pendientesDelDirector({ ...base, otras })
    expect(p).toEqual([
      { clave: 'vacia-b', texto: 'Misa b', detalle: 'domingo 25 de octubre · sin cantos', href: '/misas/b/editar' },
      { clave: 'vacia-d', texto: 'Misa d', detalle: 'domingo 8 de noviembre · sin cantos', href: '/misas/d/editar' },
    ])
  })

  test('sin misa próxima solo quedan las propuestas', () => {
    const p = pendientesDelDirector({ ...base, misa: null, inscritos: [], faltan: 4, pedidos: 3, propuestas: 2 })
    expect(p.map((x) => x.clave)).toEqual(['propuestas'])
  })

  test('una misa que ya no admite inscripción no pide músicos ni respuestas', () => {
    const p = pendientesDelDirector({ ...base, inscritos: [], faltan: 5, inscripcionAbierta: false })
    expect(p).toEqual([])
  })
})

describe('siguientesMisas', () => {
  const lista = [misa('a', '2026-10-18'), misa('b', '2026-10-25'), misa('c', '2026-11-01'), misa('d', '2026-11-08'), misa('x', null)]

  test('las que vienen después de la del Inicio, hasta tres, sin listas sin fecha', () => {
    expect(siguientesMisas(lista, '2026-10-17', 'a').map((m) => m.id)).toEqual(['b', 'c', 'd'])
    expect(siguientesMisas(lista, '2026-10-17', 'a', 2).map((m) => m.id)).toEqual(['b', 'c'])
  })

  test('la de hoy está en el Inicio, así que no se repite', () => {
    expect(siguientesMisas(lista, '2026-10-18', 'a').map((m) => m.id)).toEqual(['b', 'c', 'd'])
  })

  test('sin misa en el Inicio no hay siguientes que mostrar', () => {
    expect(siguientesMisas(lista, '2026-12-01', null)).toEqual([])
  })
})

describe('paraRepasar', () => {
  const fila = (id: string, cantoId: string) => ({ id, cantoId, titulo: cantoId, momentoNombre: 'Entrada' })

  test('los cantos de la misa que tienen partitura, una vez cada uno y en orden', () => {
    const cantos = [fila('1', 'x'), fila('2', 'y'), fila('3', 'x'), fila('4', 'z')]
    const conPartitura = new Set(['x', 'z'])
    expect(paraRepasar(cantos, conPartitura).map((c) => c.id)).toEqual(['1', '4'])
  })

  test('sin partituras, nada', () => {
    expect(paraRepasar([fila('1', 'x')], new Set())).toEqual([])
  })
})
