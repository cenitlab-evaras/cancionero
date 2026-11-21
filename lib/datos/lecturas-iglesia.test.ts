import { describe, expect, test } from 'vitest'
import { traerLecturasDeIglesia } from './lecturas-iglesia'
import { COMPLEJO, CON_SEGUNDA, VACIA } from '../motores/lecturas-iglesia.fixtures'

/**
 * El fetch de estos tests es falso: devuelve los fixtures sintéticos de la
 * tarea 3 o falla a pedido. Ningún test sale a la red.
 */
function responder(html: string): typeof fetch {
  return async () => new Response(html)
}

describe('traerLecturasDeIglesia', () => {
  test('trae las partes del día pedido con la URL exacta', async () => {
    let urlPedida = ''
    let opciones: RequestInit | undefined
    const fetchFalso: typeof fetch = async (entrada, init) => {
      urlPedida = String(entrada)
      opciones = init
      return new Response(CON_SEGUNDA)
    }

    const resultado = await traerLecturasDeIglesia('2026-11-22', fetchFalso)

    expect(urlPedida).toBe('https://www.eucaristiadiaria.cl/dia_cal.php?fecha=2026-11-22')
    expect(opciones?.cache).toBe('no-store')
    expect((opciones?.headers as Record<string, string>)['User-Agent']).toBe(
      'Cantoral/1.0 (+https://cantoral.cenitlab.cl)',
    )
    expect(opciones?.signal).toBeInstanceOf(AbortSignal)

    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return

    expect(resultado.fecha).toBe('2026-11-22')
    expect(resultado.partes.map((parte) => parte.tipo)).toEqual([
      'primera',
      'salmo',
      'segunda',
      'evangelio',
    ])
    expect(resultado.url).toBe(urlPedida)
  })

  test('una página sin lecturas es sin_datos', async () => {
    const resultado = await traerLecturasDeIglesia('2027-01-10', responder(VACIA))
    expect(resultado).toEqual({ ok: false, motivo: 'sin_datos' })
  })

  test('un día con varios formularios es complejo', async () => {
    const resultado = await traerLecturasDeIglesia('2026-12-25', responder(COMPLEJO))
    expect(resultado).toEqual({ ok: false, motivo: 'complejo' })
  })

  test('la página de otra fecha no se acepta', async () => {
    const resultado = await traerLecturasDeIglesia('2026-11-29', responder(CON_SEGUNDA))
    expect(resultado).toEqual({ ok: false, motivo: 'fecha' })
  })

  test('si el fetch falla es un problema de red', async () => {
    const fetchRoto: typeof fetch = async () => {
      throw new Error('sin red')
    }

    const resultado = await traerLecturasDeIglesia('2026-11-22', fetchRoto)
    expect(resultado).toEqual({ ok: false, motivo: 'red' })
  })
})
