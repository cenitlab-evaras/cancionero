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
  /** «Mi cuerda»: una, dos o las que se marquen (pedido del dueño, 2026-10-17). */
  | { tipo: 'frente'; cuerdas: Cuerda[] }
  | { tipo: 'estrofas'; estrofas: Cuerda[] }

/**
 * La mezcla de un botón: Mi cuerda, Coro, o estrofas combinadas.
 *
 * Una cuerda que la partitura no tiene no se inventa: se ignora, y si no queda
 * ninguna marcada se cae al coro. Sin estrofas prendidas también vuelve el
 * coro, como en `escuchar.html`.
 */
export function mezclaDe(eleccion: Eleccion, cuerdas: Cuerda[]): Mezcla {
  const coro = () => Object.fromEntries(cuerdas.map((c) => [c, esDelCoro(c) ? 1 : 0]))

  if (eleccion.tipo === 'frente') {
    const marcadas = eleccion.cuerdas.filter((c) => cuerdas.includes(c))
    if (marcadas.length === 0) return coro()
    return Object.fromEntries(
      cuerdas.map((c) => [c, marcadas.includes(c) ? 1 : esDelCoro(c) ? FONDO : 0])
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

/** Marca o desmarca una cuerda de «Mi cuerda» sin tocar las otras. */
export function alternarCuerda(marcadas: Cuerda[], cuerda: Cuerda): Cuerda[] {
  return marcadas.includes(cuerda) ? marcadas.filter((c) => c !== cuerda) : [...marcadas, cuerda]
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

/**
 * Lo que se pinta en la partitura. Con «Mi cuerda», las marcadas que suenan,
 * aunque se les haya bajado el volumen con su control: marcar es decir «esta es
 * la mía». Sin «Mi cuerda» (coro, estrofas, o la mezcla tocada a mano en el
 * panel), las que suenan más fuerte, como siempre (`alFrente`).
 */
export function cuerdasAlFrente(eleccion: Eleccion | null, mezcla: Mezcla): Cuerda[] {
  if (eleccion?.tipo === 'frente') {
    const marcadas = eleccion.cuerdas.filter((c) => (mezcla[c] ?? 0) > 0)
    if (marcadas.length > 0) return Object.keys(mezcla).filter((c) => marcadas.includes(c))
  }
  return alFrente(mezcla)
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
