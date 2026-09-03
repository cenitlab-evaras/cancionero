import { createClient } from '@/lib/supabase/server'

/**
 * Consultas de misas (H6).
 *
 * Mismo criterio que `repertorio.ts`: acá no se re-chequean permisos, la RLS
 * decide qué filas salen. Lo que sí hace falta es que la ruta distinga vacío de
 * sin-acceso (PRD §14) — por eso `obtenerMisa` devuelve `null` cuando no
 * hay fila, y la pantalla lo traduce a "no tienes acceso".
 */

export type MisaDeLista = {
  id: string
  nombre: string
  fecha: string | null
  cantidadCantos: number
  /** H15 · cuántos se anotaron. Se cuenta al leer, no se guarda. */
  anotados: number
}

export type CantoDeMisa = {
  /** El id de la FILA de `misa_cantos`, no el del canto. */
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

export type MisaCompleta = {
  id: string
  nombre: string
  fecha: string | null
  coroId: string
  cantos: CantoDeMisa[]
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
 * Las misas del coro, por fecha descendente (PRD §12).
 *
 * Las que no tienen fecha van al final: son listas de trabajo, no la misa del
 * domingo que se está buscando.
 */
export async function misasDelCoro(coroId: string): Promise<MisaDeLista[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('misas')
    // El embed nombra la foránea EXPLÍCITAMENTE. `misa_participante` llegó a
    // tener dos caminos hacia `misas` —la del `misa_id` y la compuesta que
    // cierra el agujero del `coro_id`— y con dos relaciones PostgREST no puede
    // resolver el embed: devuelve PGRST201 y esta pantalla no carga. La simple
    // se elimina en `20260903000300`, pero nombrar la compuesta es correcto
    // antes y después de esa migración, y deja de depender de que haya una sola.
    .select(
      'id, nombre, fecha, misa_cantos(id), misa_participante!participante_misa_del_mismo_coro(perfil_id)'
    )
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
    cantidadCantos: (c.misa_cantos as { id: string }[] | null)?.length ?? 0,
    // Cero para quien no puede verlos: la RLS no devuelve las filas y el
    // contador simplemente no aparece.
    anotados: (c.misa_participante as { perfil_id: string }[] | null)?.length ?? 0,
  }))
}

/**
 * Una misa con sus cantos, en el orden guardado.
 *
 * Devuelve `null` cuando la RLS no deja pasar la fila, para que la ruta pueda
 * decir "no tienes acceso" en vez de mostrar una misa vacía (PRD §14).
 */
export async function obtenerMisa(misaId: string): Promise<MisaCompleta | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('misas')
    .select(
      'id, nombre, fecha, coro_id, misa_cantos(id, canto_id, orden, momentos_liturgicos(nombre, orden), cantos(titulo, tonalidad_original, fuente_numero, autores(nombre)))'
    )
    .eq('id', misaId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const filas = (data.misa_cantos ?? []) as unknown as FilaCanto[]

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
 * Los cantos del coro que todavía NO están en la misa, con su momento.
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
