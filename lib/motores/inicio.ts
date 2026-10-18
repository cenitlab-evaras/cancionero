import { agruparMisas } from './agenda'
import { fechaLarga } from './fecha'
import type { Inscrito } from './inscripcion'

/**
 * El Inicio como tablero (2026-10-17, pedido del dueño). Motor PURO: decide qué
 * avisos y qué listas ve cada uno; la pantalla solo los pinta. `hoy` entra por
 * parámetro, como en `agenda.ts`.
 *
 * La pregunta que contesta es la del domingo en la mañana: el miembro quiere
 * saber qué se canta, decir si va y repasar; el director, además, qué le falta
 * resolver antes de llegar. Todo se calcula al leer (PRD §8, regla 3).
 */

type Misa = { id: string; nombre: string; fecha: string | null; cantidadCantos: number }

export type Pendiente = {
  clave: string
  texto: string
  /** Una segunda línea, en tenue: el día de una misa. */
  detalle?: string
  href: string
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/**
 * Lo que el director tiene pendiente, en el orden en que conviene resolverlo:
 * primero la misa que viene (sin cantos no hay misa; sin músicos no hay con qué
 * tocar; los que no respondieron son a quién escribirle), después lo que el coro
 * pidió y, al final, las misas siguientes que todavía no se arman.
 *
 * «Nadie se anotó a tocar» se avisa solo con CERO músicos: avisar por cada
 * instrumento que falta sería ruido, porque no todas las misas llevan flauta.
 */
export function pendientesDelDirector(e: {
  misa: Misa | null
  inscritos: Inscrito[]
  /** Cuántos del coro todavía no dijeron si van (`quienFalta`). */
  faltan: number
  /** Pedidos de cantos PARA la misa del Inicio. */
  pedidos: number
  /** Propuestas generales al repertorio, que no cuelgan de ninguna misa. */
  propuestas: number
  /** Las misas que vienen después de la del Inicio. */
  otras: Misa[]
  /** Falso cuando la misa ya no admite inscripción (`sePuedeInscribir`). */
  inscripcionAbierta?: boolean
}): Pendiente[] {
  const p: Pendiente[] = []
  const abierta = e.inscripcionAbierta ?? true

  if (e.misa) {
    const enLaMisa = `/misas/${e.misa.id}`
    if (e.misa.cantidadCantos === 0) {
      p.push({ clave: 'sin-cantos', texto: 'La misa todavía no tiene cantos', href: `${enLaMisa}/editar` })
    }
    if (abierta && !e.inscritos.some((i) => i.aporte === 'instrumental')) {
      p.push({ clave: 'sin-musicos', texto: 'Nadie se anotó a tocar todavía', href: enLaMisa })
    }
    if (abierta && e.faltan > 0) {
      p.push({
        clave: 'faltan',
        texto:
          e.faltan === 1
            ? '1 persona del coro no ha dicho si va'
            : `${e.faltan} personas del coro no han dicho si van`,
        href: enLaMisa,
      })
    }
    if (e.pedidos > 0) {
      p.push({
        clave: 'pedidos',
        texto: `${plural(e.pedidos, 'pedido', 'pedidos')} de cantos para esta misa`,
        href: enLaMisa,
      })
    }
  }

  if (e.propuestas > 0) {
    p.push({
      clave: 'propuestas',
      texto: `${plural(e.propuestas, 'canto propuesto', 'cantos propuestos')} para el repertorio`,
      href: '/sugerencias',
    })
  }

  for (const m of e.otras.filter((o) => o.cantidadCantos === 0).slice(0, 2)) {
    p.push({
      clave: `vacia-${m.id}`,
      texto: m.nombre,
      detalle: `${m.fecha ? fechaLarga(m.fecha) : 'Sin fecha'} · sin cantos`,
      href: `/misas/${m.id}/editar`,
    })
  }

  return p
}

/**
 * Las misas agendadas que vienen después de la que muestra el Inicio. Sin misa
 * en el Inicio no hay «después»: la pantalla ya dice que no hay nada agendado.
 * Las listas sin fecha no son misas que vengan (`agenda.ts`).
 */
export function siguientesMisas<T extends { id: string; fecha: string | null }>(
  misas: T[],
  hoy: string,
  idDelInicio: string | null,
  cuantas = 3
): T[] {
  if (!idDelInicio) return []
  return agruparMisas(misas, hoy)
    .proximas.filter((m) => m.id !== idDelInicio)
    .slice(0, cuantas)
}

/**
 * Los cantos de la misa que se pueden repasar en «Partitura», en el orden de la
 * misa. Un canto que va en dos momentos se repasa una vez.
 */
export function paraRepasar<T extends { cantoId: string }>(cantos: T[], conPartitura: Set<string>): T[] {
  const vistos = new Set<string>()
  return cantos.filter((c) => conPartitura.has(c.cantoId) && !vistos.has(c.cantoId) && vistos.add(c.cantoId))
}
