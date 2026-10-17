import { esDelCoro, esEstrofa, type Cuerda } from './cuerdas'

/**
 * La mezcla del reproductor — PRD §21.6.
 *
 * Una mezcla es `{cuerda: volumen}` con volúmenes de 0 a 1. Las reglas son las
 * de `escuchar.html`, que el dueño validó escuchando, y las de
 * `motor/logica.py`, que hace el video: los dos tienen que estar de acuerdo en
 * quién va al frente, o el video pinta un pentagrama distinto del que sonaba.
 * Por eso los casos de `alFrente` están en `casos/al-frente.json`.
 */

/** El resto del coro con «Mi cuerda» al frente. Igual que `FONDO` en motor/logica.py. */
export const FONDO = 0.22
/** El coro de fondo cuando suenan estrofas de solista. */
export const FONDO_ESTROFAS = 0.45

export type Mezcla = Record<Cuerda, number>

export type Eleccion =
  | { tipo: 'coro' }
  | { tipo: 'frente'; cuerda: Cuerda }
  | { tipo: 'estrofas'; estrofas: Cuerda[] }

/**
 * La mezcla de un botón: Mi cuerda, Coro, o estrofas combinadas.
 *
 * Una cuerda que la partitura no tiene no se inventa: se cae al coro. Y sin
 * estrofas prendidas también vuelve el coro, como en `escuchar.html`.
 */
export function mezclaDe(eleccion: Eleccion, cuerdas: Cuerda[]): Mezcla {
  const coro = () => Object.fromEntries(cuerdas.map((c) => [c, esDelCoro(c) ? 1 : 0]))

  if (eleccion.tipo === 'frente') {
    if (!cuerdas.includes(eleccion.cuerda)) return coro()
    return Object.fromEntries(
      cuerdas.map((c) => [c, c === eleccion.cuerda ? 1 : esDelCoro(c) ? FONDO : 0])
    )
  }

  if (eleccion.tipo === 'estrofas') {
    const prendidas = eleccion.estrofas.filter((e) => esEstrofa(e) && cuerdas.includes(e))
    if (prendidas.length === 0) return coro()
    return Object.fromEntries(
      cuerdas.map((c) => [c, prendidas.includes(c) ? 1 : esDelCoro(c) ? FONDO_ESTROFAS : 0])
    )
  }

  return coro()
}

/**
 * Las cuerdas al frente: las que suenan al volumen más alto, en el orden de la
 * mezcla. Todo en 0 → ninguna. Es `destacadas` de motor/logica.py.
 */
export function alFrente(mezcla: Mezcla): Cuerda[] {
  const suenan = Object.entries(mezcla).filter(([, v]) => v > 0)
  if (suenan.length === 0) return []
  const maximo = Math.max(...suenan.map(([, v]) => v))
  return suenan.filter(([, v]) => v >= maximo - 0.001).map(([c]) => c)
}

/** El estado de una cuerda en el panel «Mezcla». */
export type Pista = { volumen: number; silenciada: boolean; sola: boolean }

/**
 * Lo que suena con la mezcla a mano: si alguna está «sola», suenan solo las
 * solas (aunque estén silenciadas: «sola» manda); si no, todas menos las
 * silenciadas. Cada una con su volumen, sin tocar las demás.
 */
export function volumenesQueSuenan(pistas: Record<Cuerda, Pista>): Mezcla {
  const haySola = Object.values(pistas).some((p) => p.sola)
  return Object.fromEntries(
    Object.entries(pistas).map(([c, p]) => {
      const suena = haySola ? p.sola : !p.silenciada
      return [c, suena ? p.volumen : 0]
    })
  )
}
