'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { obtenerSesion } from '@/lib/sesion'
import { puede, type Sujeto } from '@/lib/permisos'
import { normalizarEmail, vencimientoDesde } from '@/lib/motores/invitacion'
import { hashToken, tokenCrudo } from '@/lib/invitacion/token'

/**
 * El alta por invitación — docs/superpowers/specs/2026-11-25-invitaciones-design.md.
 *
 * La FORMA y la CAPACIDAD se comprueban acá; la RLS de `invitacion` vuelve a
 * decidir qué filas se pueden leer, insertar, actualizar o borrar (PRD §8.3).
 * La comprobación previa existe para devolver un mensaje en vez de un rechazo
 * mudo; no reemplaza a la política.
 *
 * LA ÚNICA EXCEPCIÓN AL CLIENTE ADMIN (aprobada en el diseño): `enviarLink`
 * usa `createAdminClient()` porque `auth.admin.inviteUserByEmail` no tiene otra
 * puerta. Nunca corre en el cliente, nunca toca tablas —la fila de `invitacion`
 * la escribe la sesión del que invita— y solo se alcanza después de validar la
 * capacidad y el coro.
 */

type Resultado = { ok: true; coroId?: string } | { ok: false; error: string }

const Correo = z
  .string()
  .trim()
  .min(1, 'Escribe el correo de la persona.')
  .email('Escribe un correo válido.')

const InvitarDirector = z.object({
  email: Correo,
  coroId: z.string().uuid('Elige un coro.'),
})

const InvitarMiembro = z.object({ email: Correo })

const Id = z.string().uuid()

/** El link vuelve a la app con el token crudo; sin `SITE_URL` no hay link válido. */
function enlaceDeInvitacion(token: string): string | null {
  const base = process.env.SITE_URL?.trim()
  if (!base) return null
  return `${base.replace(/\/+$/, '')}/auth/confirm?inv=${encodeURIComponent(token)}`
}

/**
 * Manda el link de invitación.
 *
 * Cuenta nueva: `inviteUserByEmail`. Cuenta existente (ese primer intento
 * falla): link mágico, que inicia sesión sin crear un segundo perfil.
 *
 * Un fallo NO borra la invitación: la fila queda pendiente para «Reenviar»,
 * que es justo lo que el diseño pide cuando el SMTP está caído.
 */
async function enviarLink(email: string, redirectTo: string): Promise<Resultado> {
  let admin
  try {
    admin = createAdminClient()
  } catch {
    return { ok: false, error: 'El envío de correos no está configurado en el servidor.' }
  }

  const invitacion = await admin.auth.admin.inviteUserByEmail(email, { redirectTo })
  if (!invitacion.error) return { ok: true }

  const magico = await admin.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: redirectTo },
  })
  if (!magico.error) return { ok: true }

  return {
    ok: false,
    error:
      'No pudimos enviar el correo de invitación. La invitación quedó pendiente: reintenta con «Reenviar».',
  }
}

/** Las dos pantallas que listan pendientes se refrescan tras cualquier cambio. */
function refrescarListas() {
  revalidatePath('/admin/perfiles')
  revalidatePath('/coro/miembros')
}

/** El mensaje exacto para los errores que la RLS deja llegar del insert. */
function errorDeInsercion(error: { code?: string | null }): string {
  if (error.code === '23505') {
    return 'Ya hay una invitación pendiente para ese correo en ese coro.'
  }
  if (error.code === '23503') {
    return 'Ese coro ya no existe o no puedes invitarlo.'
  }
  return 'No pudimos crear la invitación.'
}

/** Admin y director comparten reenviar/revocar; el miembro no llega hasta acá. */
function administraInvitaciones(sujeto: Sujeto): boolean {
  return puede(sujeto, 'invitar_director') || puede(sujeto, 'invitar_miembro')
}

// --- Invitar -------------------------------------------------------------------

export async function invitarDirector(raw: unknown): Promise<Resultado> {
  const datos = InvitarDirector.safeParse(raw)
  if (!datos.success) {
    return { ok: false, error: datos.error.issues[0]?.message ?? 'Revisa los datos.' }
  }

  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Tu sesión expiró. Vuelve a entrar.' }
  if (!puede(sesion.sujeto, 'invitar_director')) {
    return { ok: false, error: 'Invitar directores es trabajo de un administrador.' }
  }

  const email = normalizarEmail(datos.data.email)
  const token = tokenCrudo()
  const redirectTo = enlaceDeInvitacion(token)
  if (!redirectTo) return { ok: false, error: 'Falta configurar SITE_URL en el servidor.' }

  const supabase = await createClient()
  const { error } = await supabase.from('invitacion').insert({
    email,
    coro_id: datos.data.coroId,
    rol_local: 'director',
    token_hash: hashToken(token),
    creada_por: sesion.usuarioId,
    expira_en: vencimientoDesde(new Date()),
  })

  if (error) return { ok: false, error: errorDeInsercion(error) }

  const envio = await enviarLink(email, redirectTo)
  refrescarListas()
  return envio.ok ? { ok: true } : envio
}

export async function invitarMiembro(raw: unknown): Promise<Resultado> {
  const datos = InvitarMiembro.safeParse(raw)
  if (!datos.success) {
    return { ok: false, error: datos.error.issues[0]?.message ?? 'Revisa los datos.' }
  }

  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Tu sesión expiró. Vuelve a entrar.' }

  // La regla del dueño: invitar MIEMBROS es del director DEL CORO. La
  // capacidad `invitar_miembro` ya es `solo_director`, pero se pide el vínculo
  // explícito para que el mensaje y la RLS digan lo mismo.
  const coro = sesion.coroActivo
  if (!coro || coro.rolLocal !== 'director' || !puede(sesion.sujeto, 'invitar_miembro')) {
    return { ok: false, error: 'Solo el director de este coro puede invitar miembros.' }
  }

  const email = normalizarEmail(datos.data.email)
  const token = tokenCrudo()
  const redirectTo = enlaceDeInvitacion(token)
  if (!redirectTo) return { ok: false, error: 'Falta configurar SITE_URL en el servidor.' }

  const supabase = await createClient()
  const { error } = await supabase.from('invitacion').insert({
    email,
    coro_id: coro.id,
    rol_local: 'miembro',
    token_hash: hashToken(token),
    creada_por: sesion.usuarioId,
    expira_en: vencimientoDesde(new Date()),
  })

  if (error) return { ok: false, error: errorDeInsercion(error) }

  const envio = await enviarLink(email, redirectTo)
  refrescarListas()
  return envio.ok ? { ok: true } : envio
}

// --- Mantener una pendiente -----------------------------------------------------

export async function reenviarInvitacion(raw: unknown): Promise<Resultado> {
  const id = Id.safeParse(raw)
  if (!id.success) return { ok: false, error: 'Revisa los datos.' }

  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Tu sesión expiró. Vuelve a entrar.' }
  if (!administraInvitaciones(sesion.sujeto)) {
    return { ok: false, error: 'No tienes permiso para reenviar invitaciones.' }
  }

  const supabase = await createClient()

  // La RLS recorta: un director no ve las de director ni las de otro coro.
  const { data: fila, error: lectura } = await supabase
    .from('invitacion')
    .select('id, email, aceptada_en')
    .eq('id', id.data)
    .maybeSingle()

  if (lectura) return { ok: false, error: 'No pudimos leer la invitación.' }
  if (!fila) return { ok: false, error: 'Esa invitación no existe o ya no puedes verla.' }
  if (fila.aceptada_en) return { ok: false, error: 'Esa invitación ya fue aceptada.' }

  const token = tokenCrudo()
  const redirectTo = enlaceDeInvitacion(token)
  if (!redirectTo) return { ok: false, error: 'Falta configurar SITE_URL en el servidor.' }

  // El token viejo deja de valer: hay uno solo por invitación pendiente.
  // `select` confirma que la RLS dejó actualizar la fila que se leyó.
  const { data: actualizada, error } = await supabase
    .from('invitacion')
    .update({ token_hash: hashToken(token), expira_en: vencimientoDesde(new Date()) })
    .eq('id', id.data)
    .select('id')

  if (error) return { ok: false, error: 'No pudimos reenviar la invitación.' }
  if (!actualizada || actualizada.length === 0) {
    return { ok: false, error: 'Esa invitación ya no se puede reenviar.' }
  }

  const envio = await enviarLink(normalizarEmail(fila.email as string), redirectTo)
  refrescarListas()
  return envio.ok ? { ok: true } : envio
}

export async function revocarInvitacion(raw: unknown): Promise<Resultado> {
  const id = Id.safeParse(raw)
  if (!id.success) return { ok: false, error: 'Revisa los datos.' }

  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Tu sesión expiró. Vuelve a entrar.' }
  if (!administraInvitaciones(sesion.sujeto)) {
    return { ok: false, error: 'No tienes permiso para revocar invitaciones.' }
  }

  const supabase = await createClient()

  // `select` sobre el delete devuelve las filas borradas: con 0 filas se
  // distingue «no existe / no la alcanzas» de un error de verdad, en vez de
  // decir que revocó algo que la RLS dejó intacto.
  const { data, error } = await supabase
    .from('invitacion')
    .delete()
    .eq('id', id.data)
    .select('id')

  if (error) return { ok: false, error: 'No pudimos revocar la invitación.' }
  if (!data || data.length === 0) {
    return { ok: false, error: 'Esa invitación no existe o ya no puedes verla.' }
  }

  refrescarListas()
  return { ok: true }
}

// --- Aceptar --------------------------------------------------------------------

const Token = z.string().trim().min(1, 'La invitación no es válida o venció.')

/**
 * Aceptar NO consulta `puede('aceptar_invitacion')` a propósito.
 *
 * El perfil recién invitado tiene `aprobado = false`, y el portón global de
 * `puede()` devolvería false justo cuando la invitación existe para aprobarlo.
 * Basta con que haya sesión: la RPC valida hash, email, vencimiento y uso, y es
 * la que crea el vínculo y aprueba el perfil. No se afloja `puede()`.
 */
export async function aceptarInvitacion(raw: unknown): Promise<Resultado> {
  const token = Token.safeParse(raw)
  if (!token.success) {
    return { ok: false, error: token.error.issues[0]?.message ?? 'La invitación no es válida o venció.' }
  }

  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Entra con el correo invitado antes de aceptar.' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('aceptar_invitacion', {
    p_hash: hashToken(token.data),
  })

  if (error) {
    // La RPC levanta «La invitación no es válida o venció»; se muestra tal cual.
    return { ok: false, error: error.message || 'La invitación no es válida o venció.' }
  }

  revalidatePath('/', 'layout')
  return { ok: true, coroId: typeof data === 'string' ? data : undefined }
}
