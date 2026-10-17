'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { COOKIE_CORO, obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { buscarCantos } from '@/lib/datos/repertorio'

const Entrada = z.object({ coroId: z.string().uuid() })

/**
 * Fija el coro activo de la sesión.
 *
 * Una server action es alcanzable por POST directo, no solo desde la UI, así
 * que valida la entrada Y comprueba el vínculo con el servidor. Acá no hay
 * escritura en la base: el alcance real lo sigue imponiendo la RLS en cada
 * consulta posterior. Esto solo evita que alguien fije como "activo" un coro
 * del que no es parte y después vea un repertorio vacío sin entender por qué.
 */
export async function fijarCoroActivo(raw: unknown) {
  const { coroId } = Entrada.parse(raw)

  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false as const, error: 'Sesión expirada.' }

  const pertenece = sesion.coros.some((c) => c.id === coroId)
  if (!pertenece) return { ok: false as const, error: 'No perteneces a ese coro.' }

  const cookieStore = await cookies()
  cookieStore.set(COOKIE_CORO, coroId, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })

  revalidatePath('/', 'layout')
  return { ok: true as const }
}

/**
 * La búsqueda de la cabecera, mientras se escribe (2026-10-17).
 *
 * Es una action y no una ruta porque solo la llama la app. Lee con la sesión
 * del usuario y en su coro activo: la RLS decide qué cantos existen para él,
 * igual que en el repertorio. Sin sesión, sin aprobar o sin coro: nada.
 */
const Busqueda = z.string().max(80)

export async function buscarCantosAhora(raw: unknown) {
  const termino = Busqueda.safeParse(raw)
  if (!termino.success) return []
  const sesion = await obtenerSesion()
  if (!sesion?.coroActivo || !puede(sesion.sujeto, 'ver_repertorio')) return []
  return buscarCantos(sesion.coroActivo.id, termino.data)
}
