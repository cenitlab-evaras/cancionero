import { describe, expect, test } from 'vitest'
import casos from './casos/al-frente.json'
import { FONDO, FONDO_ESTROFAS, alFrente, mezclaDe, volumenesQueSuenan, type Pista } from './mezcla'

/**
 * La mezcla del reproductor (PRD §21.6).
 *
 * Una «mezcla» es el volumen de cada cuerda, de 0 a 1. «Al frente» son las que
 * suenan al volumen más alto: con Mi cuerda: Tenor, el tenor; con el coro
 * parejo, las cuatro; con estrofas prendidas, las estrofas.
 */

const CUERDAS = ['soprano', 'contralto', 'tenor', 'bajo', 'solista-1', 'solista-2', 'solista-3']

describe('alFrente — los mismos casos que el motor de exportación', () => {
  for (const caso of casos.casos) {
    test(caso.nombre, () => {
      expect(alFrente(caso.volumenes)).toEqual(caso.alFrente)
    })
  }
})

describe('mezclaDe', () => {
  test('Mi cuerda: Tenor → tenor 1, el resto del coro de fondo y los solistas callados', () => {
    const m = mezclaDe({ tipo: 'frente', cuerda: 'tenor' }, CUERDAS)
    expect(m).toEqual({
      soprano: FONDO,
      contralto: FONDO,
      tenor: 1,
      bajo: FONDO,
      'solista-1': 0,
      'solista-2': 0,
      'solista-3': 0,
    })
    expect(FONDO).toBe(0.22)
    expect(alFrente(m)).toEqual(['tenor'])
  })

  test('Coro → las cuatro en 1 y los solistas en 0', () => {
    const m = mezclaDe({ tipo: 'coro' }, CUERDAS)
    expect(m).toEqual({
      soprano: 1,
      contralto: 1,
      tenor: 1,
      bajo: 1,
      'solista-1': 0,
      'solista-2': 0,
      'solista-3': 0,
    })
    expect(alFrente(m)).toEqual(['soprano', 'contralto', 'tenor', 'bajo'])
  })

  test('Estrofa 1 + Estrofa 3 suenan juntas sobre el coro de fondo', () => {
    const m = mezclaDe({ tipo: 'estrofas', estrofas: ['solista-1', 'solista-3'] }, CUERDAS)
    expect(m['solista-1']).toBe(1)
    expect(m['solista-3']).toBe(1)
    expect(m['solista-2']).toBe(0)
    expect(m.tenor).toBe(FONDO_ESTROFAS)
    expect(FONDO_ESTROFAS).toBe(0.45)
    expect(alFrente(m)).toEqual(['solista-1', 'solista-3'])
  })

  test('sin estrofas prendidas vuelve el coro completo', () => {
    expect(mezclaDe({ tipo: 'estrofas', estrofas: [] }, CUERDAS)).toEqual(
      mezclaDe({ tipo: 'coro' }, CUERDAS)
    )
  })

  test('solo se mezclan las cuerdas que la partitura tiene', () => {
    const m = mezclaDe({ tipo: 'frente', cuerda: 'bajo' }, ['soprano', 'bajo'])
    expect(m).toEqual({ soprano: FONDO, bajo: 1 })
  })

  test('una cuerda que la partitura no tiene no se inventa: queda el coro', () => {
    const m = mezclaDe({ tipo: 'frente', cuerda: 'tenor' }, ['soprano', 'bajo'])
    expect(m).toEqual({ soprano: 1, bajo: 1 })
  })
})

describe('volumenesQueSuenan — la mezcla a mano del panel «Mezcla»', () => {
  const pistas = (p: Record<string, Partial<Pista>>): Record<string, Pista> =>
    Object.fromEntries(
      Object.entries(p).map(([c, x]) => [c, { volumen: 1, silenciada: false, sola: false, ...x }])
    )

  test('cambiar el volumen de una cuerda no toca las demás', () => {
    const v = volumenesQueSuenan(pistas({ soprano: { volumen: 0.3 }, tenor: {}, bajo: {} }))
    expect(v).toEqual({ soprano: 0.3, tenor: 1, bajo: 1 })
  })

  test('silenciar deja la cuerda en 0', () => {
    const v = volumenesQueSuenan(pistas({ soprano: { silenciada: true }, tenor: {} }))
    expect(v).toEqual({ soprano: 0, tenor: 1 })
  })

  test('con alguna «sola», suenan solo las solas, con su volumen', () => {
    const v = volumenesQueSuenan(
      pistas({ soprano: { sola: true, volumen: 0.5 }, tenor: {}, bajo: { silenciada: true, sola: true } })
    )
    expect(v).toEqual({ soprano: 0.5, tenor: 0, bajo: 1 })
  })
})
