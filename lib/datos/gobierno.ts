import { createClient } from '@/lib/supabase/server'
import type { Rol, RolLocal } from '@/lib/permisos'

/**
 * Consultas de gobierno (H7): quién está en el coro y quién espera aprobación.
 */

export type PerfilConVinculo = {
  id: string
  email: string
  nombre: string | null
  rol: Rol
  aprobado: boolean
  /** Su rol en ESTE coro, o `null` si no pertenece. */
  rolLocal: RolLocal | null
  /** El id de la fila de `coro_acceso`, para poder cambiarla o borrarla. */
  accesoId: string | null
}

/**
 * Todos los perfiles que el usuario alcanza, con su vínculo a un coro dado.
 *
 * Dos consultas y no un join: `perfiles` y `coro_acceso` tienen políticas
 * distintas, y cruzarlas en SQL escondería cuál de las dos recortó qué.
 */
export async function perfilesConVinculo(coroId: string): Promise<PerfilConVinculo[]> {
  const supabase = await createClient()

  const [{ data: perfiles, error: e1 }, { data: accesos, error: e2 }] = await Promise.all([
    supabase.from('perfiles').select('id, email, nombre, rol, aprobado').order('email'),
    supabase.from('coro_acceso').select('id, perfil_id, rol_local').eq('coro_id', coroId),
  ])

  if (e1) throw e1
  if (e2) throw e2

  const porPerfil = new Map(
    (accesos ?? []).map((a) => [a.perfil_id as string, a as { id: string; rol_local: RolLocal }])
  )

  return (perfiles ?? []).map((p) => {
    const acceso = porPerfil.get(p.id)
    return {
      id: p.id,
      email: p.email,
      nombre: p.nombre,
      rol: p.rol as Rol,
      aprobado: p.aprobado,
      rolLocal: acceso ? acceso.rol_local : null,
      accesoId: acceso ? acceso.id : null,
    }
  })
}

export type CoroDeAdmin = { id: string; nombre: string; parroquia: string | null; miembros: number }

/** Los coros de la instalación, con cuántos miembros tiene cada uno. */
export async function corosDeLaInstalacion(): Promise<CoroDeAdmin[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('coros')
    .select('id, nombre, parroquia, coro_acceso(id)')
    .order('nombre')

  if (error) throw error

  return (data ?? []).map((c) => ({
    id: c.id,
    nombre: c.nombre,
    parroquia: c.parroquia,
    // Contado al leer, nunca guardado (innegociable 4).
    miembros: (c.coro_acceso as { id: string }[] | null)?.length ?? 0,
  }))
}
