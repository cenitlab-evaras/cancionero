import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { esRolValido, type Rol, type RolLocal, type Sujeto } from '@/lib/permisos'

/**
 * El sujeto se arma UNA VEZ, del lado del servidor, y se pasa a los componentes.
 * No se reconstruye a mano en cada pantalla, para que ninguna se olvide del
 * portón `aprobado` ni del vínculo con el coro (PRD §8.3).
 */

export const COOKIE_CORO = 'cantoral_coro'

export type CoroDelUsuario = {
  id: string
  nombre: string
  parroquia: string | null
  rolLocal: RolLocal
}

export type SesionCantoral = {
  usuarioId: string
  email: string
  nombre: string | null
  sujeto: Sujeto
  /** Si `perfiles.rol` traía un valor que ESTA versión conoce. Ver `porQueNoEntra`. */
  rolReconocido: boolean
  coros: CoroDelUsuario[]
  /** El coro activo: el de la cookie si es válido, si no el primero. */
  coroActivo: CoroDelUsuario | null
}

/**
 * Devuelve la sesión completa, o null si no hay usuario autenticado.
 *
 * Ojo con la diferencia que importa: un usuario SIN coros no es lo mismo que un
 * usuario sin acceso. El primero es un estado vacío legítimo (PRD §14).
 */
export async function obtenerSesion(): Promise<SesionCantoral | null> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: perfil } = await supabase
    .from('perfiles')
    .select('id, email, nombre, rol, aprobado')
    .eq('id', user.id)
    .maybeSingle()

  // Sin perfil (el trigger no alcanzó a correr) se trata como no aprobado:
  // el portón cierra hacia el NO.
  //
  // Y SE GUARDA SI EL ROL ERA RECONOCIBLE, que es distinto de cuál quedó. Sin
  // este dato, un rol que la app no conoce se vuelve indistinguible de un
  // `externo` legítimo, y la pantalla de espera termina afirmando que falta una
  // aprobación que ya está — pasó el 2026-09-03, al migrar `miembro` a
  // `usuario` sin desplegar. Cerrar hacia el NO está bien; perder el motivo, no.
  const rolReconocido = !!perfil && esRolValido(perfil.rol)
  const rol = rolReconocido ? (perfil!.rol as Rol) : 'externo'
  const aprobado = perfil?.aprobado ?? false

  // Los coros salen de coro_acceso, filtrando SIEMPRE por el perfil propio.
  //
  // No alcanza con confiar en la RLS acá: la política de `coro_acceso` deja al
  // admin ver los vínculos de todos —los necesita para gobernar el coro en H7—,
  // así que sin este `eq` un admin heredaría el `rol_local` de otra persona y
  // `permisos.ts` le daría capacidades por un vínculo ajeno.
  //
  // La política está bien; lo que hay que precisar es la pregunta: "mis
  // vínculos" no es lo mismo que "los vínculos que puedo ver".
  const { data: accesos } = await supabase
    .from('coro_acceso')
    .select('rol_local, coros(id, nombre, parroquia)')
    .eq('perfil_id', user.id)
    .order('created_at', { ascending: true })

  const coros: CoroDelUsuario[] = (accesos ?? [])
    .filter((a) => a.coros !== null)
    .map((a) => {
      const coro = a.coros as unknown as { id: string; nombre: string; parroquia: string | null }
      return {
        id: coro.id,
        nombre: coro.nombre,
        parroquia: coro.parroquia,
        rolLocal: a.rol_local as RolLocal,
      }
    })

  const cookieStore = await cookies()
  const preferido = cookieStore.get(COOKIE_CORO)?.value
  const coroActivo = coros.find((c) => c.id === preferido) ?? coros[0] ?? null

  return {
    usuarioId: user.id,
    email: perfil?.email ?? user.email ?? '',
    nombre: perfil?.nombre ?? null,
    sujeto: { rol, aprobado, rolLocal: coroActivo?.rolLocal ?? null },
    rolReconocido,
    coros,
    coroActivo,
  }
}
