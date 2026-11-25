import { createClient } from '@/lib/supabase/server'
import { hashToken } from '@/lib/invitacion/token'
import { ROLES_LOCALES, type RolLocal } from '@/lib/permisos'

/**
 * Invitaciones (2026-11-25).
 *
 * Como el resto de `lib/datos`, no se re-chequean permisos: la RLS de
 * `invitacion` decide qué filas salen. El admin ve todas; un director ve solo
 * las de MIEMBRO de su coro. El invitado no lee la tabla: su pantalla usa la
 * RPC `invitacion_publica`, que compara el correo con su sesión.
 */

export type InvitacionPendiente = {
  id: string
  email: string
  rolLocal: RolLocal
  coroId: string
  expiraEn: string
  creadaEn: string
}

/**
 * Las invitaciones TODAVÍA sin aceptar, de la más nueva a la más vieja.
 *
 * `coroId` en `null` significa «todas las que alcanzo» (el admin); con un id,
 * las de ese coro (el director). La RLS recorta en los dos casos.
 */
export async function invitacionesPendientes(
  coroId: string | null
): Promise<InvitacionPendiente[]> {
  const supabase = await createClient()

  // Se arma la consulta entera antes de esperarla: `eq` devuelve el mismo
  // builder, así el orden y el filtro de pendientes no se repiten en dos ramas.
  const consulta = supabase
    .from('invitacion')
    .select('id, email, rol_local, coro_id, expira_en, created_at')
    .is('aceptada_en', null)
    .order('created_at', { ascending: false })

  const { data, error } = coroId ? await consulta.eq('coro_id', coroId) : await consulta

  if (error) throw error

  return (data ?? []).map((fila) => ({
    id: fila.id as string,
    email: fila.email as string,
    rolLocal: fila.rol_local as RolLocal,
    coroId: fila.coro_id as string,
    expiraEn: fila.expira_en as string,
    creadaEn: fila.created_at as string,
  }))
}

/**
 * Lo que la pantalla de aceptación puede mostrar antes de unirse: el coro y el
 * rol. La RPC solo responde si el hash es válido, no venció, no se usó y el
 * correo coincide con la sesión; si no, no hay fila y se devuelve `null`.
 */
export async function datosDeInvitacion(
  token: string
): Promise<{ coroNombre: string; rolLocal: RolLocal } | null> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('invitacion_publica', {
    p_hash: hashToken(token),
  })

  if (error) throw error

  const fila = (Array.isArray(data) ? data[0] : data) as
    | { coro_nombre: string; rol_local: string }
    | undefined

  if (!fila) return null

  // La base ya limita el rol con un check; un valor desconocido no se pinta a
  // medias: se trata como invitación inválida.
  if (!(ROLES_LOCALES as readonly string[]).includes(fila.rol_local)) return null

  return { coroNombre: fila.coro_nombre, rolLocal: fila.rol_local as RolLocal }
}
