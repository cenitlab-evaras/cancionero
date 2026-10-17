import { CUERDAS_DEL_CORO, type CuerdaDelCoro } from './cuerdas'

/**
 * Quién canta cada estrofa (pedido del dueño, 2026-10-17). Motor PURO.
 *
 * Se guarda DENTRO del cifrado, en la primera línea de la estrofa, con una
 * directiva propia de ChordPro (las que empiezan con `x_` están permitidas para
 * eso): `{x_canta: mujeres}`. Así va con el texto: si el cifrado se edita y una
 * estrofa se mueve, su marca se mueve con ella. Una estrofa es un bloque de
 * líneas entre líneas en blanco, igual que en `renderizarCifrado`.
 */

export const QUIENES = ['todos', 'mujeres', 'hombres', 'solista', ...CUERDAS_DEL_CORO] as const
export type QuienCanta = (typeof QUIENES)[number]

export const MARCA = /^\{\s*x_canta\s*:\s*(.*?)\s*\}\s*$/i

export function esQuienCanta(valor: unknown): valor is QuienCanta {
  return typeof valor === 'string' && (QUIENES as readonly string[]).includes(valor)
}

export type Estrofa = {
  /** Primera y última línea (índices del cifrado, inclusive). */
  desde: number
  hasta: number
  canta: QuienCanta | null
}

export function estrofasDe(cifrado: string): Estrofa[] {
  const lineas = cifrado.split('\n')
  const estrofas: Estrofa[] = []
  let actual: Estrofa | null = null
  lineas.forEach((l, i) => {
    if (l.trim() === '') {
      actual = null
      return
    }
    if (!actual) {
      const m = MARCA.exec(l.trim())
      const valor = m?.[1].toLowerCase()
      actual = { desde: i, hasta: i, canta: esQuienCanta(valor) ? valor : null }
      estrofas.push(actual)
    } else {
      actual.hasta = i
    }
  })
  return estrofas
}

/** El cifrado con la estrofa `indice` marcada (o desmarcada con null). */
export function marcarEstrofa(cifrado: string, indice: number, canta: QuienCanta | null): string {
  const estrofa = estrofasDe(cifrado)[indice]
  if (!estrofa) return cifrado
  const lineas = cifrado.split('\n')
  const tieneMarca = MARCA.test(lineas[estrofa.desde].trim())
  const nueva = canta ? [`{x_canta: ${canta}}`] : []
  lineas.splice(estrofa.desde, tieneMarca ? 1 : 0, ...nueva)
  return lineas.join('\n')
}

/** Qué cuerdas del coro cantan esa estrofa. El solista no es ninguna. */
export function cuerdasQueCantan(canta: QuienCanta): CuerdaDelCoro[] {
  if (canta === 'todos') return [...CUERDAS_DEL_CORO]
  if (canta === 'mujeres') return ['soprano', 'contralto']
  if (canta === 'hombres') return ['tenor', 'bajo']
  if (canta === 'solista') return []
  return [canta]
}

const NOMBRE: Record<QuienCanta, string> = {
  todos: 'Todos',
  mujeres: 'Mujeres',
  hombres: 'Hombres',
  solista: 'Solista',
  soprano: 'Sopranos',
  contralto: 'Contraltos',
  tenor: 'Tenores',
  bajo: 'Bajos',
}

export function nombreDeQuienCanta(canta: QuienCanta): string {
  return NOMBRE[canta]
}
