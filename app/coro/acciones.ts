'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { obtenerSesion } from '@/lib/sesion'
import { puede, type Capacidad } from '@/lib/permisos'
import { puedeCambiarRol } from '@/lib/motores/gobierno'

/**
 * Gobierno del coro y de la instalación (H7).
 *
 * Cada acción comprueba el rol en el servidor ADEMÁS de la RLS (§8.3), y las
 * que vinculan a alguien consultan el mismo motor que consulta la pantalla —
 * así el mensaje que se ve y la regla que se aplica son el mismo texto.
 */

export type Resultado = { ok: true } | { ok: false; error: string }

type Contexto =
  | { ok: false; error: string }
  | { ok: true; coroId: string; esAdmin: boolean }

async function exigir(capacidad: Capacidad, mensaje: string): Promise<Contexto> {
  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Tu sesión expiró. Vuelve a entrar.' }
  if (!puede(sesion.sujeto, capacidad)) return { ok: false, error: mensaje }
  if (!sesion.coroActivo) return { ok: false, error: 'No tienes un coro activo.' }
  return {
    ok: true,
    coroId: sesion.coroActivo.id,
    esAdmin: sesion.sujeto.rol === 'admin',
  }
}

// --- El director gobierna su coro ---------------------------------------------

/**
 * Un miembro entra SOLO por invitación (2026-11-25): la selección de perfiles
 * existentes se retiró y la RLS de `coro_acceso` ya no tiene política de insert.
 * Por eso acá no hay «agregar»: está `invitarMiembro` en
 * `app/invitaciones/acciones.ts`.
 */

const CambiarRol = z.object({
  accesoId: z.string().uuid(),
  rolLocal: z.enum(['director', 'miembro']),
})

export async function cambiarRolLocal(raw: unknown): Promise<Resultado> {
  const datos = CambiarRol.safeParse(raw)
  if (!datos.success) return { ok: false, error: 'Revisa los datos.' }

  const ctx = await exigir(
    'administrar_miembros',
    'No tienes permiso para administrar los miembros de este coro.'
  )
  if (!ctx.ok) return ctx

  // Promover o degradar directores es del admin: un director no se crea a otro
  // director ni se quita solo. La RLS de `coro_acceso` lo impide; esto devuelve
  // el motivo antes de que el update afecte cero filas.
  if (!ctx.esAdmin) {
    return { ok: false, error: 'Solo el administrador cambia roles locales' }
  }

  const supabase = await createClient()

  // Un coro sin director no puede volver a armar una misa, y nadie podría
  // deshacerlo desde la app. Se frena acá, con su motivo.
  if (datos.data.rolLocal === 'miembro') {
    const { data: acceso } = await supabase
      .from('coro_acceso')
      .select('rol_local')
      .eq('id', datos.data.accesoId)
      .maybeSingle()

    if (acceso?.rol_local === 'director') {
      const { data: cuantos } = await supabase.rpc('directores_de', { p_coro_id: ctx.coroId })
      if ((cuantos ?? 0) <= 1) {
        return {
          ok: false,
          error: 'Es el único director del coro. Nombra a otro antes de cambiarle el rol.',
        }
      }
    }
  }

  const { error } = await supabase
    .from('coro_acceso')
    .update({ rol_local: datos.data.rolLocal })
    .eq('id', datos.data.accesoId)

  if (error) return { ok: false, error: 'No pudimos cambiar el rol.' }

  revalidatePath('/coro/miembros')
  return { ok: true }
}

const Quitar = z.object({ accesoId: z.string().uuid() })

/**
 * Saca a alguien del coro activo.
 *
 * El director quita MIEMBROS; las filas de director solo las quita el admin (la
 * RLS de `coro_acceso` ya lo exige, acá se convierte en un mensaje). La fila se
 * lee primero con la sesión del usuario: si la RLS no la deja ver, no se borra
 * a ciegas.
 */
export async function quitarMiembro(raw: unknown): Promise<Resultado> {
  const datos = Quitar.safeParse(raw)
  if (!datos.success) return { ok: false, error: 'Revisa los datos.' }

  const ctx = await exigir(
    'administrar_miembros',
    'No tienes permiso para administrar los miembros de este coro.'
  )
  if (!ctx.ok) return ctx

  const supabase = await createClient()

  const { data: fila, error: lectura } = await supabase
    .from('coro_acceso')
    .select('id, coro_id, rol_local')
    .eq('id', datos.data.accesoId)
    .maybeSingle()

  if (lectura) return { ok: false, error: 'No pudimos leer ese vínculo con el coro.' }
  if (!fila) return { ok: false, error: 'Esa persona no está en el coro o ya no puedes verla.' }

  // El admin quita cualquiera; un director, solo miembros de SU coro activo.
  if (!ctx.esAdmin) {
    if (fila.coro_id !== ctx.coroId) {
      return { ok: false, error: 'Esa persona no está en tu coro activo.' }
    }
    if (fila.rol_local !== 'miembro') {
      return { ok: false, error: 'Solo el administrador puede quitar a un director del coro.' }
    }
  }

  const { data: borradas, error } = await supabase
    .from('coro_acceso')
    .delete()
    .eq('id', datos.data.accesoId)
    .select('id')

  if (error) return { ok: false, error: 'No pudimos quitar a esa persona del coro.' }
  if (!borradas || borradas.length === 0) {
    return { ok: false, error: 'Esa persona ya no está en el coro.' }
  }

  revalidatePath('/coro/miembros')
  return { ok: true }
}

// --- El admin gobierna la instalación -----------------------------------------

const Aprobar = z.object({ perfilId: z.string().uuid(), aprobado: z.boolean() })

export async function aprobarPerfil(raw: unknown): Promise<Resultado> {
  const datos = Aprobar.safeParse(raw)
  if (!datos.success) return { ok: false, error: 'Revisa los datos.' }

  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Tu sesión expiró. Vuelve a entrar.' }
  if (!puede(sesion.sujeto, 'aprobar_perfil')) {
    return { ok: false, error: 'Aprobar cuentas es trabajo de un administrador.' }
  }

  // Nadie se desaprueba a sí mismo y se deja fuera de la instalación.
  if (datos.data.perfilId === sesion.usuarioId && !datos.data.aprobado) {
    return { ok: false, error: 'No puedes quitarte tu propia aprobación.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('perfiles')
    .update({ aprobado: datos.data.aprobado, updated_at: new Date().toISOString() })
    .eq('id', datos.data.perfilId)

  if (error) return { ok: false, error: 'No pudimos actualizar la aprobación.' }

  revalidatePath('/admin/perfiles')
  return { ok: true }
}

const CrearCoro = z.object({
  nombre: z.string().trim().min(1, 'Ponle un nombre al coro.'),
  parroquia: z.string().trim().optional(),
})

export async function crearCoro(raw: unknown): Promise<Resultado> {
  const datos = CrearCoro.safeParse(raw)
  if (!datos.success) {
    return { ok: false, error: datos.error.issues[0]?.message ?? 'Revisa los datos.' }
  }

  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Tu sesión expiró. Vuelve a entrar.' }
  if (!puede(sesion.sujeto, 'crear_coro')) {
    return { ok: false, error: 'Crear coros es trabajo de un administrador.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('coros')
    .insert({ nombre: datos.data.nombre, parroquia: datos.data.parroquia || null })

  if (error) {
    const repetido = error.code === '23505'
    return {
      ok: false,
      error: repetido ? 'Ya existe un coro con ese nombre.' : 'No pudimos crear el coro.',
    }
  }

  revalidatePath('/admin/perfiles')
  revalidatePath('/coros')
  return { ok: true }
}

// `CambiarRol` ya está tomado por la acción del rol LOCAL (arriba): este es el
// rol GLOBAL de la cuenta, y los dos esquemas se llaman distinto para no
// pisarse.
const CambiarRolGlobal = z.object({
  perfilId: z.string().uuid(),
  rol: z.enum(['admin', 'usuario']),
})

/**
 * Cambia el rol GLOBAL de una cuenta (admin ↔ usuario).
 *
 * No se puede cambiar el propio: dejaría la instalación sin administrador.
 * La RLS (`perfiles_write = es_admin()`) vuelve a decidir; esto es el mensaje.
 */
export async function cambiarRolPerfil(raw: unknown): Promise<Resultado> {
  const datos = CambiarRolGlobal.safeParse(raw)
  if (!datos.success) return { ok: false, error: 'Revisa los datos.' }

  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Tu sesión expiró. Vuelve a entrar.' }
  if (!puede(sesion.sujeto, 'aprobar_perfil')) {
    return { ok: false, error: 'Cambiar el rol de una cuenta es trabajo de un administrador.' }
  }

  const veredicto = puedeCambiarRol(sesion.usuarioId, datos.data.perfilId)
  if (!veredicto.ok) return { ok: false, error: veredicto.motivo }

  const supabase = await createClient()
  const { error } = await supabase
    .from('perfiles')
    .update({ rol: datos.data.rol, updated_at: new Date().toISOString() })
    .eq('id', datos.data.perfilId)

  if (error) return { ok: false, error: 'No pudimos cambiar el rol.' }

  revalidatePath('/admin/perfiles')
  return { ok: true }
}
