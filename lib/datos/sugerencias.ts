import { createClient } from '@/lib/supabase/server'
import type { Sugerencia } from '@/lib/motores/sugerencia'

/**
 * Las sugerencias del coro (H17).
 *
 * Como en el resto de la capa de datos, no se re-chequean permisos: la RLS
 * decide qué filas salen. `sugerencia_select` es `puede_ver_coro`, así que
 * quien no es del coro obtiene cero — y la RUTA distingue «nadie propuso nada»
 * de «no tienes acceso» (§14).
 *
 * SE PIDEN LAS DOS LISTAS POR SEPARADO Y NO SE MEZCLAN. Rankear juntas la
 * propuesta general y la de una misa daría un número que no contesta ninguna de
 * las dos preguntas; ver el motor.
 *
 * El embed de `cantos` funciona por la foránea COMPUESTA —es la única que hay,
 * a propósito: declarar además la simple dejaría dos relaciones y PostgREST no
 * podría resolver el embed (PGRST201, la lección de H15).
 */
const COLUMNAS =
  'canto_id, momento_id, misa_id, created_at, perfil_id, cantos(titulo), momentos_liturgicos(nombre), perfiles(nombre, email)'

type Fila = {
  canto_id: string
  momento_id: string
  misa_id: string | null
  created_at: string
  perfil_id: string
  cantos: { titulo: string } | null
  momentos_liturgicos: { nombre: string } | null
  perfiles: { nombre: string | null; email: string } | null
}

function aDominio(data: unknown[]): Sugerencia[] {
  return (data as unknown as Fila[]).map((f) => ({
    cantoId: f.canto_id,
    titulo: f.cantos?.titulo ?? '(canto borrado)',
    perfilId: f.perfil_id,
    nombre: f.perfiles?.nombre ?? f.perfiles?.email ?? null,
    momentoId: f.momento_id,
    momentoNombre: f.momentos_liturgicos?.nombre ?? '',
    misaId: f.misa_id,
    creada: f.created_at,
  }))
}

/** Las propuestas GENERALES del coro: las que no cuelgan de ninguna misa. */
export async function sugerenciasGenerales(coroId: string): Promise<Sugerencia[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sugerencia')
    .select(COLUMNAS)
    .eq('coro_id', coroId)
    .is('misa_id', null)
    .order('created_at', { ascending: true })

  if (error) throw error
  return aDominio(data ?? [])
}

/** Las propuestas para UNA misa concreta. */
export async function sugerenciasDeMisa(misaId: string): Promise<Sugerencia[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sugerencia')
    .select(COLUMNAS)
    .eq('misa_id', misaId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return aDominio(data ?? [])
}

/**
 * Las propuestas de quien pregunta, para saber qué ya propuso.
 *
 * Sin esto el control no puede distinguir «todavía no la propusiste» de «ya la
 * propusiste», y la persona toca «sugerir» dos veces sin que pase nada aparente
 * —la base la frena con su índice único y el error no dice nada útil.
 */
export async function misSugerencias(coroId: string): Promise<Sugerencia[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('sugerencia')
    .select(COLUMNAS)
    .eq('coro_id', coroId)
    .eq('perfil_id', user.id)

  if (error) throw error
  return aDominio(data ?? [])
}
