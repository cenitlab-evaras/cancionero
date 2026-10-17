/**
 * «Herramientas» (pedido del dueño, 2026-10-17): interruptores que cada persona
 * prende o apaga para sí, sin cambiar lo que ven los demás. Motor PURO.
 *
 * Se guardan como lista de ids en `preferencias_perfil.herramientas`; la base
 * acepta solo estos (un `check` con la misma lista).
 */
export const HERRAMIENTAS = [
  {
    id: 'quien_canta',
    nombre: 'Quién canta cada estrofa',
    detalle: 'Una franja de color al costado: todos, mujeres, hombres o solista.',
  },
  {
    id: 'mi_cuerda',
    nombre: 'Resaltar lo que canta mi cuerda',
    detalle: 'Atenúa las estrofas que no le tocan a tu cuerda (la de tu perfil).',
  },
  {
    id: 'dar_tono',
    nombre: 'Dar el tono',
    detalle: 'Un botón en el canto que toca la nota y el acorde del tono antes de empezar.',
  },
  {
    id: 'notacion_latina',
    nombre: 'Acordes en Do-Re-Mi',
    detalle: 'Los acordes en notación latina (Do, Re, Mi) en vez de americana (C, D, E).',
  },
] as const

export type Herramienta = (typeof HERRAMIENTAS)[number]['id']

const IDS = new Set<string>(HERRAMIENTAS.map((h) => h.id))

export function esHerramienta(valor: unknown): valor is Herramienta {
  return typeof valor === 'string' && IDS.has(valor)
}

/** Lo guardado, sin lo que ya no existe ni repetidos. Basura → ninguna. */
export function normalizarHerramientas(valor: unknown): Herramienta[] {
  if (!Array.isArray(valor)) return []
  return [...new Set(valor.filter(esHerramienta))]
}

/** Prende o apaga una, sin tocar las otras. */
export function alternarHerramienta(activas: Herramienta[], h: Herramienta, prender: boolean): Herramienta[] {
  const sin = activas.filter((x) => x !== h)
  return prender ? [...sin, h] : sin
}
