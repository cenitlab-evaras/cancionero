'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { obtenerSesion } from '@/lib/sesion'
import { puede, type Capacidad } from '@/lib/permisos'
import { ordenDeInsercion, reordenar } from '@/lib/motores/celebracion'
import { obtenerCelebracion } from '@/lib/datos/celebraciones'

/**
 * Escrituras de celebraciones (H6).
 *
 * Toda acción comprueba el rol en el SERVIDOR además de la RLS (PRD §8.3): sin
 * esa comprobación, la RLS rechaza en silencio afectando cero filas y el
 * director-que-no-lo-es cree que guardó. La RLS sigue siendo la seguridad; esto
 * es lo que convierte un rechazo mudo en un mensaje.
 */

export type Resultado = { ok: true } | { ok: false; error: string }

const NO_HABILITADO = 'No tienes permiso para editar las celebraciones de este coro.'

/** Sesión + capacidad + el coro activo, que es lo que las cuatro acciones necesitan. */
type Contexto = { ok: false; error: string } | { ok: true; coroId: string }

async function exigir(capacidad: Capacidad): Promise<Contexto> {
  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Sesión expirada. Volvé a entrar.' }
  if (!sesion.coroActivo) return { ok: false, error: 'No tienes un coro activo.' }
  if (!puede(sesion.sujeto, capacidad)) return { ok: false, error: NO_HABILITADO }
  return { ok: true, coroId: sesion.coroActivo.id }
}

// -----------------------------------------------------------------------------

const Crear = z.object({
  nombre: z.string().trim().min(1, 'Ponle un nombre a la celebración.'),
  // Vacío es válido: una celebración sin fecha es legítima (PRD §18-6).
  fecha: z.string().trim().optional(),
})

export async function crearCelebracion(raw: unknown): Promise<Resultado> {
  const datos = Crear.safeParse(raw)
  if (!datos.success) {
    return { ok: false, error: datos.error.issues[0]?.message ?? 'Revisa los datos.' }
  }

  const ctx = await exigir('editar_celebracion')
  if (!ctx.ok) return ctx

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('celebraciones')
    .insert({
      coro_id: ctx.coroId,
      nombre: datos.data.nombre,
      fecha: datos.data.fecha || null,
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: 'No pudimos crear la celebración.' }

  revalidatePath('/celebraciones')
  redirect(`/celebraciones/${data.id}/editar`)
}

// -----------------------------------------------------------------------------

const Agregar = z.object({
  celebracionId: z.string().uuid(),
  cantoId: z.string().uuid(),
  momentoId: z.string().uuid(),
})

/**
 * Agrega un canto a la celebración, en la posición que le toca por su momento.
 *
 * El orden lo decide el motor puro, no esta función: acá solo se lee el estado
 * actual, se le pregunta al motor dónde va, y se corren los que quedan detrás.
 */
export async function agregarCanto(raw: unknown): Promise<Resultado> {
  const datos = Agregar.safeParse(raw)
  if (!datos.success) return { ok: false, error: 'Revisa los datos.' }

  const ctx = await exigir('asignar_cantos_celebracion')
  if (!ctx.ok) return ctx

  const celebracion = await obtenerCelebracion(datos.data.celebracionId)
  if (!celebracion) return { ok: false, error: 'No tienes acceso a esta celebración.' }

  const supabase = await createClient()

  const { data: momento } = await supabase
    .from('momentos_liturgicos')
    .select('orden')
    .eq('id', datos.data.momentoId)
    .maybeSingle()
  if (!momento) return { ok: false, error: 'Ese momento litúrgico no existe.' }

  const posicion = ordenDeInsercion(
    celebracion.cantos.map((c) => ({ orden: c.orden, momentoOrden: c.momentoOrden })),
    momento.orden
  )

  // Se renumera TODO en una pasada y se escribe con el nuevo ya intercalado.
  // Correr solo los de atrás dejaría el índice único peleando con las
  // posiciones intermedias durante la actualización.
  const idsFinales = [...celebracion.cantos.map((c) => c.id)]
  idsFinales.splice(posicion, 0, '__nuevo__')

  const { error: errInsert } = await supabase.from('celebracion_cantos').insert({
    celebracion_id: datos.data.celebracionId,
    canto_id: datos.data.cantoId,
    momento_id: datos.data.momentoId,
    // Provisorio y fuera de rango de los existentes, para no chocar con el
    // índice único antes de la renumeración de abajo.
    orden: celebracion.cantos.length + 1000,
    coro_id: celebracion.coroId,
  })

  if (errInsert) {
    const yaEstaba = errInsert.code === '23505'
    return {
      ok: false,
      error: yaEstaba ? 'Ese canto ya está en la celebración.' : 'No pudimos agregar el canto.',
    }
  }

  const { data: recien } = await supabase
    .from('celebracion_cantos')
    .select('id')
    .eq('celebracion_id', datos.data.celebracionId)
    .eq('canto_id', datos.data.cantoId)
    .maybeSingle()

  if (recien) {
    const finales = idsFinales.map((id) => (id === '__nuevo__' ? recien.id : id))
    await escribirOrden(finales)
  }

  revalidatePath(`/celebraciones/${datos.data.celebracionId}`)
  revalidatePath(`/celebraciones/${datos.data.celebracionId}/editar`)
  return { ok: true }
}

// -----------------------------------------------------------------------------

const Quitar = z.object({
  celebracionId: z.string().uuid(),
  filaId: z.string().uuid(),
})

export async function quitarCanto(raw: unknown): Promise<Resultado> {
  const datos = Quitar.safeParse(raw)
  if (!datos.success) return { ok: false, error: 'Revisa los datos.' }

  const ctx = await exigir('quitar_canto_celebracion')
  if (!ctx.ok) return ctx

  const celebracion = await obtenerCelebracion(datos.data.celebracionId)
  if (!celebracion) return { ok: false, error: 'No tienes acceso a esta celebración.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('celebracion_cantos')
    .delete()
    .eq('id', datos.data.filaId)

  if (error) return { ok: false, error: 'No pudimos quitar el canto.' }

  // Quitar deja un hueco en el orden. Se renumera para que siga siendo
  // 0,1,2… y el recorrido no dependa de números arbitrarios.
  await escribirOrden(celebracion.cantos.filter((c) => c.id !== datos.data.filaId).map((c) => c.id))

  revalidatePath(`/celebraciones/${datos.data.celebracionId}`)
  revalidatePath(`/celebraciones/${datos.data.celebracionId}/editar`)
  return { ok: true }
}

// -----------------------------------------------------------------------------

const Mover = z.object({
  celebracionId: z.string().uuid(),
  filaId: z.string().uuid(),
  direccion: z.enum(['arriba', 'abajo']),
})

/** Mueve un canto una posición. El orden explícito manda sobre el del momento. */
export async function moverCanto(raw: unknown): Promise<Resultado> {
  const datos = Mover.safeParse(raw)
  if (!datos.success) return { ok: false, error: 'Revisa los datos.' }

  const ctx = await exigir('asignar_cantos_celebracion')
  if (!ctx.ok) return ctx

  const celebracion = await obtenerCelebracion(datos.data.celebracionId)
  if (!celebracion) return { ok: false, error: 'No tienes acceso a esta celebración.' }

  const ids = celebracion.cantos.map((c) => c.id)
  const i = ids.indexOf(datos.data.filaId)
  const j = datos.data.direccion === 'arriba' ? i - 1 : i + 1
  if (i === -1 || j < 0 || j >= ids.length) return { ok: true } // ya está en la punta

  ;[ids[i], ids[j]] = [ids[j], ids[i]]
  await escribirOrden(ids)

  revalidatePath(`/celebraciones/${datos.data.celebracionId}`)
  revalidatePath(`/celebraciones/${datos.data.celebracionId}/editar`)
  return { ok: true }
}

// -----------------------------------------------------------------------------

/**
 * Escribe el orden que decidió el motor.
 *
 * En dos pasadas por el índice único `(celebracion_id, orden)`: primero todos a
 * un rango que no puede chocar, después a su posición final. Sin esto, mover el
 * 2 al 1 falla mientras el 1 todavía ocupa esa posición.
 */
async function escribirOrden(idsEnOrden: string[]) {
  const supabase = await createClient()
  const finales = reordenar(idsEnOrden)

  for (const { id, orden } of finales) {
    await supabase.from('celebracion_cantos').update({ orden: orden + 10000 }).eq('id', id)
  }
  for (const { id, orden } of finales) {
    await supabase.from('celebracion_cantos').update({ orden }).eq('id', id)
  }
}
