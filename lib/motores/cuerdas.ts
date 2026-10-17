import type { Tesitura } from './ficha'

/**
 * Las cuerdas de una partitura — PRD §21.2.
 *
 * Una cuerda es cada línea que se canta aparte: las cuatro del coro y las
 * estrofas de solista. No es la TESITURA (H14), que es de la persona: la
 * tesitura dice qué canta alguien; la cuerda, qué está escrito. Y no se llama
 * «voz» (§19.4): esa palabra quedó sin uso por la colisión tesitura/pista.
 */

export const CUERDAS_DEL_CORO = ['soprano', 'contralto', 'tenor', 'bajo'] as const
export type CuerdaDelCoro = (typeof CUERDAS_DEL_CORO)[number]

/**
 * `soprano`… `bajo`; una de ellas dividida (`contralto-1`, `tenor-2`), como en
 * «Cantaré por siempre», que tiene seis pentagramas; o `solista-n` con n ≥ 1.
 */
export type Cuerda = string

const ESTROFA = /^solista-([1-9]\d*)$/
const DIVIDIDA = /^(soprano|contralto|tenor|bajo)-([12])$/

export function esCuerda(valor: unknown): valor is Cuerda {
  return typeof valor === 'string' && (esDelCoro(valor) || ESTROFA.test(valor))
}

/** Del coro: una de las cuatro, entera o dividida. Las estrofas de solista no. */
export function esDelCoro(cuerda: Cuerda): boolean {
  return (CUERDAS_DEL_CORO as readonly string[]).includes(cuerda) || DIVIDIDA.test(cuerda)
}

export function esEstrofa(cuerda: Cuerda): boolean {
  return ESTROFA.test(cuerda)
}

const NOMBRE: Record<CuerdaDelCoro, string> = {
  soprano: 'Soprano',
  contralto: 'Contralto',
  tenor: 'Tenor',
  bajo: 'Bajo',
}

/** «Tenor», «Tenor 1», «Estrofa 2». Lo que se lee en pantalla y en el video. */
export function nombreDeCuerda(cuerda: Cuerda): string {
  if ((CUERDAS_DEL_CORO as readonly string[]).includes(cuerda)) return NOMBRE[cuerda as CuerdaDelCoro]
  const d = DIVIDIDA.exec(cuerda)
  if (d) return `${NOMBRE[d[1] as CuerdaDelCoro]} ${d[2]}`
  const n = ESTROFA.exec(cuerda)
  return n ? `Estrofa ${n[1]}` : cuerda
}

/**
 * Coro de agudo a grave —cada división tras la anterior: Contralto 1, Contralto
 * 2—, después las estrofas por su número (no por texto: 2 antes que 10).
 */
export function ordenarCuerdas(cuerdas: Cuerda[]): Cuerda[] {
  const rango = (c: Cuerda) => {
    const i = (CUERDAS_DEL_CORO as readonly string[]).indexOf(c)
    if (i >= 0) return i * 10
    const d = DIVIDIDA.exec(c)
    if (d) return (CUERDAS_DEL_CORO as readonly string[]).indexOf(d[1]) * 10 + Number(d[2])
    const n = ESTROFA.exec(c)
    return n ? 100 + Number(n[1]) : 10_000
  }
  return [...cuerdas].sort((a, b) => rango(a) - rango(b))
}

/**
 * Con qué cuerda abre «Ensayar» para esta persona, o `null` (= el coro).
 *
 * Seis tesituras y cuatro cuerdas. Mezzosoprano → contralto y barítono → bajo
 * son decisión del dueño (§18-23, 2026-10-17): es solo con qué cuerda se abre,
 * y se cambia con un toque. Si la partitura no tiene esa cuerda, `null`: mejor
 * el coro parejo que una cuerda vecina elegida a ciegas.
 */
const CUERDA_DE: Record<Tesitura, CuerdaDelCoro> = {
  soprano: 'soprano',
  mezzosoprano: 'contralto',
  contralto: 'contralto',
  tenor: 'tenor',
  baritono: 'bajo',
  bajo: 'bajo',
}

export function cuerdaPorTesitura(tesitura: Tesitura | null, cuerdas: Cuerda[]): Cuerda | null {
  if (!tesitura) return null
  const cuerda = CUERDA_DE[tesitura]
  if (cuerdas.includes(cuerda)) return cuerda
  // Dividida: abre con la primera división. La segunda está a un toque.
  return cuerdas.includes(`${cuerda}-1`) ? `${cuerda}-1` : null
}
