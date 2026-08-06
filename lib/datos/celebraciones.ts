import { createClient } from '@/lib/supabase/server'

/**
 * Consultas de celebraciones (H6).
 *
 * Mismo criterio que `repertorio.ts`: acá no se re-chequean permisos, la RLS
 * decide qué filas salen. Lo que sí hace falta es que la ruta distinga vacío de
 * sin-acceso (PRD §14) — por eso `obtenerCelebracion` devuelve `null` cuando no
 * hay fila, y la pantalla lo traduce a "no tienes acceso".
 */

export type CelebracionDeLista = {
  id: string
  nombre: string
  fecha: string | null
  cantidadCantos: number
}

export type CantoDeCelebracion = {
  /** El id de la FILA de `celebracion_cantos`, no el del canto. */
  id: string
  cantoId: string
  titulo: string
  autor: string | null
  tonalidadOriginal: string | null
  fuenteNumero: number | null
  momentoNombre: string
  momentoOrden: number
  orden: number
}

export type CelebracionCompleta = {
  id: string
  nombre: string
  fecha: string | null
  coroId: string
  cantos: CantoDeCelebracion[]
}

type FilaCanto = {
  id: string
  canto_id: string
  orden: number
  momentos_liturgicos: { nombre: string; orden: number } | null
  cantos: {
    titulo: string
    tonalidad_original: string | null
    fuente_numero: number | null
    autores: { nombre: string } | null
  } | null
}

/**
 * Las celebraciones del coro, por fecha descendente (PRD §12).
 *
 * Las que no tienen fecha van al final: son listas de trabajo, no la misa del
 * domingo que se está buscando.
 */
export async function celebracionesDelCoro(coroId: string): Promise<CelebracionDeLista[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('celebraciones')
    .select('id, nombre, fecha, celebracion_cantos(id)')
    .eq('coro_id', coroId)
    .order('fecha', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    fecha: c.fecha,
    // La cantidad se CUENTA al leer; no se guarda una columna con el total
    // (innegociable: cero derivados persistidos).
    cantidadCantos: (c.celebracion_cantos as { id: string }[] | null)?.length ?? 0,
  }))
}

/**
 * Una celebración con sus cantos, en el orden guardado.
 *
 * Devuelve `null` cuando la RLS no deja pasar la fila, para que la ruta pueda
 * decir "no tienes acceso" en vez de mostrar una misa vacía (PRD §14).
 */
export async function obtenerCelebracion(celebracionId: string): Promise<CelebracionCompleta | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('celebraciones')
    .select(
      'id, nombre, fecha, coro_id, celebracion_cantos(id, canto_id, orden, momentos_liturgicos(nombre, orden), cantos(titulo, tonalidad_original, fuente_numero, autores(nombre)))'
    )
    .eq('id', celebracionId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const filas = (data.celebracion_cantos ?? []) as unknown as FilaCanto[]

  return {
    id: data.id,
    nombre: data.nombre,
    fecha: data.fecha,
    coroId: data.coro_id,
    cantos: filas
      .map((f) => ({
        id: f.id,
        cantoId: f.canto_id,
        titulo: f.cantos?.titulo ?? '(canto no disponible)',
        autor: f.cantos?.autores?.nombre ?? null,
        tonalidadOriginal: f.cantos?.tonalidad_original ?? null,
        fuenteNumero: f.cantos?.fuente_numero ?? null,
        momentoNombre: f.momentos_liturgicos?.nombre ?? '—',
        momentoOrden: f.momentos_liturgicos?.orden ?? 0,
        orden: f.orden,
      }))
      // El orden que se ve es el que se guardó: se ordena acá y no se confía
      // en cómo vino el anidado de PostgREST.
      .sort((a, b) => a.orden - b.orden),
  }
}

/**
 * Los cantos del coro que todavía NO están en la celebración, con su momento.
 * Es lo que se ofrece al armar la misa.
 */
export async function cantosDisponibles(
  coroId: string,
  yaAsignados: string[]
): Promise<{ id: string; titulo: string; momentoId: string; momentoNombre: string; momentoOrden: number }[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('canto_momentos')
    .select('canto_id, momento_id, cantos(titulo), momentos_liturgicos(nombre, orden)')
    .eq('coro_id', coroId)

  if (error) throw error

  const asignados = new Set(yaAsignados)

  return (data ?? [])
    .map((f) => {
      const canto = f.cantos as unknown as { titulo: string } | null
      const momento = f.momentos_liturgicos as unknown as { nombre: string; orden: number } | null
      return {
        id: f.canto_id as string,
        titulo: canto?.titulo ?? '',
        momentoId: f.momento_id as string,
        momentoNombre: momento?.nombre ?? '—',
        momentoOrden: momento?.orden ?? 0,
      }
    })
    .filter((c) => !asignados.has(c.id))
    .sort((a, b) => a.momentoOrden - b.momentoOrden || a.titulo.localeCompare(b.titulo, 'es'))
}
