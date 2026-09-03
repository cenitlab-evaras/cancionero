'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { obtenerSesion } from '@/lib/sesion'
import { puede, type Capacidad } from '@/lib/permisos'
import { puedeVincularse } from '@/lib/motores/gobierno'

/**
 * Gobierno del coro y de la instalación (H7).
 *
 * Cada acción comprueba el rol en el servidor ADEMÁS de la RLS (§8.3), y las
 * que vinculan a alguien consultan el mismo motor que consulta la pantalla —
 * así el mensaje que se ve y la regla que se aplica son el mismo texto.
 */

export type Resultado = { ok: true } | { ok: false; error: string }

type Contexto = { ok: false; error: string } | { ok: true; coroId: string }

async function exigir(capacidad: Capacidad, mensaje: string): Promise<Contexto> {
  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Sesión expirada. Volvé a entrar.' }
  if (!puede(sesion.sujeto, capacidad)) return { ok: false, error: mensaje }
  if (!sesion.coroActivo) return { ok: false, error: 'No tienes un coro activo.' }
  return { ok: true, coroId: sesion.coroActivo.id }
}

// --- El director gobierna su coro ---------------------------------------------

const Vincular = z.object({
  perfilId: z.string().uuid(),
  rolLocal: z.enum(['director', 'miembro']),
})

export async function agregarMiembro(raw: unknown): Promise<Resultado> {
  const datos = Vincular.safeParse(raw)
  if (!datos.success) return { ok: false, error: 'Revisa los datos.' }

  const ctx = await exigir(
    'administrar_miembros',
    'No tienes permiso para administrar los miembros de este coro.'
  )
  if (!ctx.ok) return ctx

  const supabase = await createClient()

  // El orden de §8.4: aprobado primero, vinculado después. La RLS lo exige
  // igual; esto convierte su rechazo mudo en el motivo exacto.
  const { data: perfil } = await supabase
    .from('perfiles')
    .select('aprobado, rol')
    .eq('id', datos.data.perfilId)
    .maybeSingle()

  if (!perfil) return { ok: false, error: 'Ese perfil no existe o no lo alcanzas.' }

  const veredicto = puedeVincularse({ aprobado: perfil.aprobado, rol: perfil.rol })
  if (!veredicto.ok) return { ok: false, error: veredicto.motivo }

  const { error } = await supabase.from('coro_acceso').insert({
    perfil_id: datos.data.perfilId,
    coro_id: ctx.coroId,
    rol_local: datos.data.rolLocal,
  })

  if (error) {
    const yaEstaba = error.code === '23505'
    return {
      ok: false,
      error: yaEstaba ? 'Esa persona ya está en el coro.' : 'No pudimos agregarla al coro.',
    }
  }

  revalidatePath('/coro/miembros')
  return { ok: true }
}

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

// --- El admin gobierna la instalación -----------------------------------------

const Aprobar = z.object({ perfilId: z.string().uuid(), aprobado: z.boolean() })

export async function aprobarPerfil(raw: unknown): Promise<Resultado> {
  const datos = Aprobar.safeParse(raw)
  if (!datos.success) return { ok: false, error: 'Revisa los datos.' }

  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Sesión expirada. Volvé a entrar.' }
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
  if (!sesion) return { ok: false, error: 'Sesión expirada. Volvé a entrar.' }
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
