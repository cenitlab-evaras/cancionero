import { createClient } from '@/lib/supabase/server'
import {
  historialDeCanto,
  resumirHistorial,
  type EjecucionCruda,
  type HistorialCanto,
} from '@/lib/motores/historial'
import { fechaEnZona } from '@/lib/motores/fecha'

/**
 * Consultas del historial de ejecución (H13).
 *
 * Cero tablas nuevas: lo que se lee es lo que H6 ya guarda. Una fila de
 * `celebracion_cantos` cruzada con su celebración ES una ejecución.
 *
 * Como en el resto de la capa de datos, no se re-chequean permisos: la RLS
 * decide qué filas salen. Un músico de otro coro obtiene cero y eso es correcto.
 */

/**
 * El día de hoy como `YYYY-MM-DD`, en la zona del coro.
 *
 * Fijada explícitamente el 2026-09-02, al desplegar: el contenedor corre en UTC
 * y §17.1-octies ya había declarado la consecuencia — entre las 20:00 y la
 * medianoche en Chile el servidor estaba en el día siguiente, y una misa
 * agendada para mañana se contaba como ya cantada.
 *
 * Lo único que esta función hace es leer el reloj: la conversión vive en
 * `fechaEnZona`, que es pura y tiene sus casos en `fecha.test.ts`.
 */
export function hoyISO(): string {
  return fechaEnZona(new Date())
}

type FilaEjecucion = {
  canto_id: string
  celebraciones: { id: string; nombre: string; fecha: string | null } | null
  momentos_liturgicos: { nombre: string } | null
}

/** Todas las ejecuciones del coro, crudas: el motor decide cuáles cuentan. */
async function ejecucionesDelCoro(coroId: string): Promise<EjecucionCruda[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('celebracion_cantos')
    .select('canto_id, celebraciones(id, nombre, fecha), momentos_liturgicos(nombre)')
    .eq('coro_id', coroId)

  if (error) throw error

  // El filtro de "ya ocurrió" NO se hace acá con un `.lte('fecha', hoy)`: vive
  // en el motor, que está probado. Si estuviera en los dos lados, algún día
  // dirían cosas distintas.
  return ((data ?? []) as unknown as FilaEjecucion[])
    .filter((f) => f.celebraciones !== null && f.momentos_liturgicos !== null)
    .map((f) => ({
      cantoId: f.canto_id,
      celebracionId: f.celebraciones!.id,
      celebracionNombre: f.celebraciones!.nombre,
      fecha: f.celebraciones!.fecha,
      momento: f.momentos_liturgicos!.nombre,
    }))
}

/** El historial de UN canto, para el resumen de su vista de lectura. */
export async function historialDelCanto(
  coroId: string,
  cantoId: string
): Promise<HistorialCanto> {
  const todas = await ejecucionesDelCoro(coroId)
  return historialDeCanto(
    todas.filter((e) => e.cantoId === cantoId),
    hoyISO()
  )
}

export type CantoConHistorial = {
  id: string
  titulo: string
  autor: string | null
  historial: HistorialCanto
}

/**
 * Todo el repertorio con su historial, para `/historial`.
 *
 * Se parte del REPERTORIO y no de las ejecuciones: un canto que nunca se cantó
 * no tiene ni una fila en `celebracion_cantos`, y si la lista saliera de ahí
 * sería justamente el que no aparecería — cuando es el que más importa ver.
 */
export async function repertorioConHistorial(coroId: string): Promise<CantoConHistorial[]> {
  const supabase = await createClient()

  const [{ data: cantos, error }, ejecuciones] = await Promise.all([
    supabase.from('cantos').select('id, titulo, autores(nombre)').eq('coro_id', coroId),
    ejecucionesDelCoro(coroId),
  ])

  if (error) throw error

  const porCanto = resumirHistorial(ejecuciones, hoyISO())
  const vacio: HistorialCanto = {
    veces: 0,
    ultima: null,
    diasDesdeUltima: null,
    cadaCuantosDias: null,
    ejecuciones: [],
    agendadas: [],
    porMomento: [],
  }

  return ((cantos ?? []) as unknown as { id: string; titulo: string; autores: { nombre: string } | null }[]).map(
    (c) => ({
      id: c.id,
      titulo: c.titulo,
      autor: c.autores?.nombre ?? null,
      historial: porCanto.get(c.id) ?? vacio,
    })
  )
}
