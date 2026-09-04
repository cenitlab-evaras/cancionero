'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'

/**
 * Volver a una versión anterior del cifrado (H19-A).
 *
 * VOLVER NO BORRA NADA, y esa es la decisión que hace que el hito sirva de red:
 * restaurar es un `update` común de `cantos.cifrado`, así que dispara el mismo
 * trigger que cualquier edición y **guarda como versión el cifrado que estaba**.
 * Se puede volver a ir. Un «deshacer» que destruyera el estado actual sería otra
 * operación irreversible, que es exactamente lo que §18-13 vino a resolver.
 *
 * La capacidad se comprueba acá además de la RLS (§8.3): la RLS rechaza mudo
 * con cero filas y el usuario creería que guardó.
 */

export type ResultadoRestaurar = { ok: true } | { ok: false; error: string }

const NO_PUEDE = 'No tienes permiso para cambiar el repertorio de este coro.'

export async function restaurarVersion(
  cantoId: string,
  versionId: string
): Promise<ResultadoRestaurar> {
  const ids = z
    .object({ cantoId: z.string().uuid(), versionId: z.string().uuid() })
    .safeParse({ cantoId, versionId })
  if (!ids.success) return { ok: false, error: 'Esa versión no existe.' }

  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Sesión expirada. Vuelve a entrar.' }
  if (!sesion.coroActivo) return { ok: false, error: 'No perteneces a ningún coro.' }
  if (!puede(sesion.sujeto, 'restaurar_version_canto')) return { ok: false, error: NO_PUEDE }

  const supabase = await createClient()

  // El `canto_id` va en el filtro y no se confía del cliente: sin eso, un id de
  // versión de OTRO canto del mismo coro pasaría la RLS y pisaría este cifrado
  // con un texto que no es suyo.
  const { data: version, error: errorVersion } = await supabase
    .from('canto_version')
    .select('cifrado')
    .eq('id', ids.data.versionId)
    .eq('canto_id', ids.data.cantoId)
    .maybeSingle()

  if (errorVersion) return { ok: false, error: 'No pudimos leer esa versión.' }
  if (!version) return { ok: false, error: 'Esa versión no existe.' }

  const { data, error } = await supabase
    .from('cantos')
    .update({ cifrado: version.cifrado, updated_at: new Date().toISOString() })
    .eq('id', ids.data.cantoId)
    .select('id')
    .maybeSingle()

  if (error) return { ok: false, error: 'No pudimos guardar el cambio.' }
  // Cero filas sin error es la RLS diciendo que no (§14).
  if (!data) return { ok: false, error: NO_PUEDE }

  revalidatePath(`/repertorio/${ids.data.cantoId}`)
  revalidatePath(`/repertorio/${ids.data.cantoId}/versiones`)
  return { ok: true }
}
