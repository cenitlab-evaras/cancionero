import { createClient } from '@/lib/supabase/server'
import type { VersionGuardada } from '@/lib/motores/version-cifrado'

/**
 * El historial de cambios del cifrado de un canto (H19-A).
 *
 * Como en el resto de la capa de datos, no se re-chequean permisos: la RLS
 * decide qué filas salen. `canto_version_select` es `puede_ver_coro`, así que
 * quien no es del coro obtiene cero filas — y la RUTA distingue «nunca se
 * editó» de «no tienes acceso» (§14).
 *
 * NO HAY ESCRITURA EN ESTE ARCHIVO, Y LA AUSENCIA ES EL HITO. Las filas las
 * pone un trigger de la base; la tabla no tiene política de escritura ni grant
 * de insert. Si alguna vez alguien agrega acá un `.insert()`, va a fallar — y
 * ese fallo es la protección funcionando, no un bug.
 *
 * El embed de `perfiles` no es ambiguo: `reemplazado_por` es la única foránea
 * entre las dos tablas (la de `cantos` es compuesta y va contra otra tabla).
 */
const COLUMNAS = 'id, cifrado, reemplazado_en, perfiles(nombre, email)'

type Fila = {
  id: string
  cifrado: string
  reemplazado_en: string
  perfiles: { nombre: string | null; email: string } | null
}

/** De la más reciente a la más vieja, que es como se lee y como la pide el motor. */
export async function versionesDeCanto(cantoId: string): Promise<VersionGuardada[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('canto_version')
    .select(COLUMNAS)
    .eq('canto_id', cantoId)
    .order('reemplazado_en', { ascending: false })

  if (error) throw error

  return ((data ?? []) as unknown as Fila[]).map((f) => ({
    id: f.id,
    cifrado: f.cifrado,
    reemplazadoEn: f.reemplazado_en,
    // Nulo cuando el `update` no vino de una sesión —la semilla, los
    // importadores—. No se rellena con un nombre inventado: la pantalla dice
    // que no se sabe.
    quien: f.perfiles?.nombre ?? f.perfiles?.email ?? null,
  }))
}

/** Cuántas veces se editó el cifrado. Se calcula al leer, nunca se guarda. */
export async function contarVersiones(cantoId: string): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('canto_version')
    .select('id', { count: 'exact', head: true })
    .eq('canto_id', cantoId)

  if (error) throw error
  return count ?? 0
}
