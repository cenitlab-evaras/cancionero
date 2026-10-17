import { createClient } from '@/lib/supabase/server'
import { estaArchivado, normalizarEstado, type EstadoCanto } from '@/lib/motores/estado-canto'
import { fechaEnZona } from '@/lib/motores/fecha'
import { CUERDAS_DEL_CORO, cuerdaPorTesitura, type Cuerda } from '@/lib/motores/cuerdas'
import { esTesituraValida } from '@/lib/motores/ficha'
import { iniciales } from '@/lib/motores/iniciales'

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
  /**
   * Quiénes, con sus iniciales y su cuerda (2026-10-17). La cuerda sale de la
   * ficha, que desde H14 solo leen su dueño y el director: para el resto viene
   * nula y el círculo va sin color. Es la RLS la que decide, no esta consulta.
   */
  quienes: { perfilId: string; iniciales: string; nombre: string; cuerda: Cuerda | null }[]
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
  /**
   * H27 · El tono en que va este canto EN ESTA MISA, en semitonos respecto del
   * cifrado. `null` = sin fijar: cada persona ve su tono personal.
   */
  tonoDeMisa: number | null
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
  transposicion: number | null
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
      'id, nombre, fecha, misa_cantos(id), misa_participante!participante_misa_del_mismo_coro(perfil_id, perfiles(nombre, email))'
    )
    .eq('coro_id', coroId)
    .order('fecha', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw error

  // La cuerda de cada uno, de su ficha en este coro: la RLS devuelve todas al
  // director y solo la propia a los demás (H14).
  const { data: fichas } = await supabase.from('ficha_miembro').select('perfil_id, tesitura').eq('coro_id', coroId)
  const cuerdaDe = new Map(
    (fichas ?? []).map((f) => [
      f.perfil_id as string,
      esTesituraValida(f.tesitura) ? cuerdaPorTesitura(f.tesitura, [...CUERDAS_DEL_CORO]) : null,
    ])
  )
  const ordenCuerda = (c: Cuerda | null) => (c ? CUERDAS_DEL_CORO.indexOf(c as never) : CUERDAS_DEL_CORO.length)

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
    quienes: ((c.misa_participante ?? []) as unknown as {
      perfil_id: string
      perfiles: { nombre: string | null; email: string } | null
    }[])
      .map((p) => ({
        perfilId: p.perfil_id,
        iniciales: iniciales(p.perfiles?.nombre ?? null, p.perfiles?.email ?? null),
        nombre: p.perfiles?.nombre?.trim() || p.perfiles?.email || 'Alguien',
        cuerda: cuerdaDe.get(p.perfil_id) ?? null,
      }))
      // De agudo a grave, y al final las cuerdas que no se pueden ver.
      .sort((a, b) => ordenCuerda(a.cuerda) - ordenCuerda(b.cuerda)),
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
      'id, nombre, fecha, coro_id, misa_cantos(id, canto_id, orden, transposicion, momentos_liturgicos(nombre, orden), cantos(titulo, tonalidad_original, fuente_numero, autores(nombre)))'
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
        tonoDeMisa: f.transposicion,
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
export type CantoDisponible = {
  id: string
  titulo: string
  momentoId: string
  momentoNombre: string
  momentoOrden: number
  /** H18 · para no recomendar archivados y para ordenar los nunca cantados. */
  estado: EstadoCanto
  /** H18 · `YYYY-MM-DD` de la última vez que sonó, o `null` si nunca. */
  ultima: string | null
}

export async function cantosDisponibles(
  coroId: string,
  yaAsignados: string[]
): Promise<CantoDisponible[]> {
  const supabase = await createClient()

  // H18 · cuándo sonó por última vez cada canto. UNA consulta para todo el
  // repertorio y no una por canto: el armador dibuja los once momentos de una,
  // y ochenta y siete consultas encadenadas se notarían en el teléfono.
  //
  // Mismo criterio de «ya ocurrió» que el historial y la agenda: fecha
  // declarada y no futura. Si acá dijéramos otra cosa, el mismo domingo
  // contaría como cantado en una pantalla y como pendiente en la otra.
  const [{ data, error }, { data: sonadas }] = await Promise.all([
    supabase
      .from('canto_momentos')
      .select('canto_id, momento_id, cantos(titulo, estado), momentos_liturgicos(nombre, orden)')
      .eq('coro_id', coroId),
    supabase
      .from('misa_cantos')
      .select('canto_id, misas(fecha)')
      .eq('coro_id', coroId),
  ])

  if (error) throw error

  const hoy = fechaEnZona(new Date())
  const ultimaDe = new Map<string, string>()
  for (const fila of sonadas ?? []) {
    const misa = fila.misas as unknown as { fecha: string | null } | null
    const fecha = misa?.fecha
    if (!fecha || fecha > hoy) continue
    const previa = ultimaDe.get(fila.canto_id as string)
    if (!previa || fecha > previa) ultimaDe.set(fila.canto_id as string, fecha)
  }

  const asignados = new Set(yaAsignados)

  return (data ?? [])
    .map((f) => {
      const canto = f.cantos as unknown as { titulo: string; estado: string } | null
      const momento = f.momentos_liturgicos as unknown as { nombre: string; orden: number } | null
      return {
        id: f.canto_id as string,
        titulo: canto?.titulo ?? '',
        momentoId: f.momento_id as string,
        momentoNombre: momento?.nombre ?? '—',
        momentoOrden: momento?.orden ?? 0,
        estado: normalizarEstado(canto?.estado),
        ultima: ultimaDe.get(f.canto_id as string) ?? null,
      }
    })
    // Los archivados salieron del repertorio: tampoco se ofrecen para armar.
    // Faltaba este filtro desde que se cerró §16, y se veía acá.
    .filter((c) => !asignados.has(c.id) && !estaArchivado(c.estado))
    .sort((a, b) => a.momentoOrden - b.momentoOrden || a.titulo.localeCompare(b.titulo, 'es'))
}
