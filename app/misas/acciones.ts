'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { obtenerSesion } from '@/lib/sesion'
import { puede, type Capacidad } from '@/lib/permisos'
import { ordenDeInsercion, reordenar } from '@/lib/motores/misa'
import { validarInscripcion } from '@/lib/motores/inscripcion'
import { obtenerMisa } from '@/lib/datos/misas'

/**
 * Escrituras de misas (H6).
 *
 * Toda acción comprueba el rol en el SERVIDOR además de la RLS (PRD §8.3): sin
 * esa comprobación, la RLS rechaza en silencio afectando cero filas y el
 * director-que-no-lo-es cree que guardó. La RLS sigue siendo la seguridad; esto
 * es lo que convierte un rechazo mudo en un mensaje.
 */

export type Resultado = { ok: true } | { ok: false; error: string }

const NO_HABILITADO = 'No tienes permiso para editar las misas de este coro.'

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
  nombre: z.string().trim().min(1, 'Ponle un nombre a la misa.'),
  // Vacío es válido: una misa sin fecha es legítima (PRD §18-6).
  fecha: z.string().trim().optional(),
})

export async function crearMisa(raw: unknown): Promise<Resultado> {
  const datos = Crear.safeParse(raw)
  if (!datos.success) {
    return { ok: false, error: datos.error.issues[0]?.message ?? 'Revisa los datos.' }
  }

  const ctx = await exigir('editar_misa')
  if (!ctx.ok) return ctx

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('misas')
    .insert({
      coro_id: ctx.coroId,
      nombre: datos.data.nombre,
      fecha: datos.data.fecha || null,
    })
    .select('id')
    .single()

  if (error || !data) return { ok: false, error: 'No pudimos crear la misa.' }

  revalidatePath('/misas')
  redirect(`/misas/${data.id}/editar`)
}

// -----------------------------------------------------------------------------

const Agregar = z.object({
  misaId: z.string().uuid(),
  cantoId: z.string().uuid(),
  momentoId: z.string().uuid(),
})

/**
 * Agrega un canto a la misa, en la posición que le toca por su momento.
 *
 * El orden lo decide el motor puro, no esta función: acá solo se lee el estado
 * actual, se le pregunta al motor dónde va, y se corren los que quedan detrás.
 */
export async function agregarCanto(raw: unknown): Promise<Resultado> {
  const datos = Agregar.safeParse(raw)
  if (!datos.success) return { ok: false, error: 'Revisa los datos.' }

  const ctx = await exigir('asignar_cantos_misa')
  if (!ctx.ok) return ctx

  const misa = await obtenerMisa(datos.data.misaId)
  if (!misa) return { ok: false, error: 'No tienes acceso a esta misa.' }

  const supabase = await createClient()

  const { data: momento } = await supabase
    .from('momentos_liturgicos')
    .select('orden')
    .eq('id', datos.data.momentoId)
    .maybeSingle()
  if (!momento) return { ok: false, error: 'Ese momento litúrgico no existe.' }

  const posicion = ordenDeInsercion(
    misa.cantos.map((c) => ({ orden: c.orden, momentoOrden: c.momentoOrden })),
    momento.orden
  )

  // Se renumera TODO en una pasada y se escribe con el nuevo ya intercalado.
  // Correr solo los de atrás dejaría el índice único peleando con las
  // posiciones intermedias durante la actualización.
  const idsFinales = [...misa.cantos.map((c) => c.id)]
  idsFinales.splice(posicion, 0, '__nuevo__')

  const { error: errInsert } = await supabase.from('misa_cantos').insert({
    misa_id: datos.data.misaId,
    canto_id: datos.data.cantoId,
    momento_id: datos.data.momentoId,
    // Provisorio y fuera de rango de los existentes, para no chocar con el
    // índice único antes de la renumeración de abajo.
    orden: misa.cantos.length + 1000,
    coro_id: misa.coroId,
  })

  if (errInsert) {
    const yaEstaba = errInsert.code === '23505'
    return {
      ok: false,
      error: yaEstaba ? 'Ese canto ya está en la misa.' : 'No pudimos agregar el canto.',
    }
  }

  const { data: recien } = await supabase
    .from('misa_cantos')
    .select('id')
    .eq('misa_id', datos.data.misaId)
    .eq('canto_id', datos.data.cantoId)
    .maybeSingle()

  if (recien) {
    const finales = idsFinales.map((id) => (id === '__nuevo__' ? recien.id : id))
    await escribirOrden(finales)
  }

  revalidatePath(`/misas/${datos.data.misaId}`)
  revalidatePath(`/misas/${datos.data.misaId}/editar`)
  return { ok: true }
}

// -----------------------------------------------------------------------------

const Quitar = z.object({
  misaId: z.string().uuid(),
  filaId: z.string().uuid(),
})

export async function quitarCanto(raw: unknown): Promise<Resultado> {
  const datos = Quitar.safeParse(raw)
  if (!datos.success) return { ok: false, error: 'Revisa los datos.' }

  const ctx = await exigir('quitar_canto_misa')
  if (!ctx.ok) return ctx

  const misa = await obtenerMisa(datos.data.misaId)
  if (!misa) return { ok: false, error: 'No tienes acceso a esta misa.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('misa_cantos')
    .delete()
    .eq('id', datos.data.filaId)

  if (error) return { ok: false, error: 'No pudimos quitar el canto.' }

  // Quitar deja un hueco en el orden. Se renumera para que siga siendo
  // 0,1,2… y el recorrido no dependa de números arbitrarios.
  await escribirOrden(misa.cantos.filter((c) => c.id !== datos.data.filaId).map((c) => c.id))

  revalidatePath(`/misas/${datos.data.misaId}`)
  revalidatePath(`/misas/${datos.data.misaId}/editar`)
  return { ok: true }
}

// -----------------------------------------------------------------------------

const Mover = z.object({
  misaId: z.string().uuid(),
  filaId: z.string().uuid(),
  direccion: z.enum(['arriba', 'abajo']),
})

/** Mueve un canto una posición. El orden explícito manda sobre el del momento. */
export async function moverCanto(raw: unknown): Promise<Resultado> {
  const datos = Mover.safeParse(raw)
  if (!datos.success) return { ok: false, error: 'Revisa los datos.' }

  const ctx = await exigir('asignar_cantos_misa')
  if (!ctx.ok) return ctx

  const misa = await obtenerMisa(datos.data.misaId)
  if (!misa) return { ok: false, error: 'No tienes acceso a esta misa.' }

  const ids = misa.cantos.map((c) => c.id)
  const i = ids.indexOf(datos.data.filaId)
  const j = datos.data.direccion === 'arriba' ? i - 1 : i + 1
  if (i === -1 || j < 0 || j >= ids.length) return { ok: true } // ya está en la punta

  ;[ids[i], ids[j]] = [ids[j], ids[i]]
  await escribirOrden(ids)

  revalidatePath(`/misas/${datos.data.misaId}`)
  revalidatePath(`/misas/${datos.data.misaId}/editar`)
  return { ok: true }
}

// -----------------------------------------------------------------------------

/**
 * Escribe el orden que decidió el motor.
 *
 * En dos pasadas por el índice único `(misa_id, orden)`: primero todos a
 * un rango que no puede chocar, después a su posición final. Sin esto, mover el
 * 2 al 1 falla mientras el 1 todavía ocupa esa posición.
 */
async function escribirOrden(idsEnOrden: string[]) {
  const supabase = await createClient()
  const finales = reordenar(idsEnOrden)

  for (const { id, orden } of finales) {
    await supabase.from('misa_cantos').update({ orden: orden + 10000 }).eq('id', id)
  }
  for (const { id, orden } of finales) {
    await supabase.from('misa_cantos').update({ orden }).eq('id', id)
  }
}

// -----------------------------------------------------------------------------
// H15 · Inscripción a la misa
// -----------------------------------------------------------------------------
/**
 * Las dos únicas escrituras del miembro en dato que el coro entero lee (§19.5).
 *
 * El `perfil_id` sale de la SESIÓN, nunca del formulario. Aunque alguien mande
 * otro en el POST no hay dónde ponerlo — y si lo hubiera,
 * `misa_participante_write` lo rechazaría: la política es
 * `perfil_id = auth.uid()`.
 *
 * El `coro_id` sale de la MISA y no del coro activo de la sesión. Parecen lo
 * mismo y no lo son: mandar el coro activo dejaría que alguien se inscribiera a
 * una misa ajena poniendo su propio coro. La foránea compuesta de la migración
 * lo haría fallar igual, pero fallar con un error de integridad no es lo mismo
 * que no intentarlo.
 */
export async function guardarMiInscripcion(
  misaId: string,
  raw: { aporte: unknown; instrumento: unknown }
): Promise<Resultado> {
  const id = z.string().uuid().safeParse(misaId)
  if (!id.success) return { ok: false, error: 'Esa misa no existe.' }

  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Sesión expirada. Volvé a entrar.' }
  if (!puede(sesion.sujeto, 'inscribirse_a_misa')) {
    return { ok: false, error: 'No perteneces a este coro.' }
  }

  const validacion = validarInscripcion(raw)
  if (!validacion.ok) return { ok: false, error: validacion.error }

  // La misa se lee con la RLS puesta: si no sale, no hay acceso, y de paso trae
  // el coro al que de verdad pertenece.
  const misa = await obtenerMisa(id.data)
  if (!misa) return { ok: false, error: 'No tienes acceso a esta misa.' }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('misa_participante')
    .upsert(
      {
        misa_id: id.data,
        perfil_id: sesion.usuarioId,
        coro_id: misa.coroId,
        aporte: validacion.limpio.aporte,
        instrumento: validacion.limpio.instrumento,
      },
      { onConflict: 'misa_id,perfil_id' }
    )
    .select('perfil_id')
    .maybeSingle()

  if (error) return { ok: false, error: 'No pudimos guardar tu inscripción.' }
  // Cero filas sin error es la RLS diciendo que no (§14).
  if (!data) return { ok: false, error: 'No perteneces a este coro.' }

  revalidatePath(`/misas/${id.data}`)
  revalidatePath('/misas')
  return { ok: true }
}

export async function retirarMiInscripcion(misaId: string): Promise<Resultado> {
  const id = z.string().uuid().safeParse(misaId)
  if (!id.success) return { ok: false, error: 'Esa misa no existe.' }

  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Sesión expirada. Volvé a entrar.' }
  if (!puede(sesion.sujeto, 'inscribirse_a_misa')) {
    return { ok: false, error: 'No perteneces a este coro.' }
  }

  const supabase = await createClient()
  // El `eq` sobre el perfil propio no es redundante con la RLS: es lo que hace
  // que un borrado mal armado no dependa de la política para no llevarse la
  // fila de otro. La RLS es la seguridad; esto es no apoyarse solo en ella.
  const { error } = await supabase
    .from('misa_participante')
    .delete()
    .eq('misa_id', id.data)
    .eq('perfil_id', sesion.usuarioId)

  if (error) return { ok: false, error: 'No pudimos retirar tu inscripción.' }

  revalidatePath(`/misas/${id.data}`)
  revalidatePath('/misas')
  return { ok: true }
}
