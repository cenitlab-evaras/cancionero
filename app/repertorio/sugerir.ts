'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'

/**
 * Proponer y retirar un canto (H17).
 *
 * Las dos únicas escrituras del miembro acá, y son las suyas: el `perfil_id`
 * sale de la SESIÓN, nunca del formulario. Aunque alguien mande otro en el POST
 * no hay dónde ponerlo — y si lo hubiera, `sugerencia_write` lo rechazaría.
 *
 * EL `coro_id` SALE DEL CANTO, no del coro activo de la sesión. Parecen lo
 * mismo y no lo son: mandar el coro activo dejaría intentar proponer un canto
 * ajeno con el coro propio. Las foráneas compuestas lo rechazarían igual, pero
 * fallar por integridad no es lo mismo que no intentarlo — y el mensaje que
 * recibe la persona es muchísimo peor.
 *
 * PROPONER NO ES ASIGNAR. Esta acción no toca `misa_cantos`: meter el canto en
 * la misa sigue siendo del director (§8.2), y que el coro pida algo no lo mete
 * solo. Es exactamente el límite que §19.5 puso — el miembro aporta, no dispone.
 */

export type Resultado = { ok: true } | { ok: false; error: string }

const Entrada = z.object({
  cantoId: z.string().uuid(),
  momentoId: z.string().uuid(),
  /** `null` = propuesta general para el momento. */
  misaId: z.string().uuid().nullable(),
})

const NO_PUEDE = 'No perteneces a este coro.'

async function contexto(raw: unknown) {
  const datos = Entrada.safeParse(raw)
  if (!datos.success) return { ok: false as const, error: 'Esa propuesta no es válida.' }

  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false as const, error: 'Sesión expirada. Vuelve a entrar.' }
  if (!puede(sesion.sujeto, 'sugerir_canto')) return { ok: false as const, error: NO_PUEDE }

  const supabase = await createClient()
  // El canto se lee con la RLS puesta: si no sale, no hay acceso — y de paso
  // trae el coro al que de verdad pertenece.
  const { data: canto } = await supabase
    .from('cantos')
    .select('coro_id')
    .eq('id', datos.data.cantoId)
    .maybeSingle()
  if (!canto) return { ok: false as const, error: 'No tienes acceso a este canto.' }

  return {
    ok: true as const,
    supabase,
    perfilId: sesion.usuarioId,
    coroId: canto.coro_id as string,
    ...datos.data,
  }
}

export async function sugerirCanto(raw: unknown): Promise<Resultado> {
  const c = await contexto(raw)
  if (!c.ok) return { ok: false, error: c.error }

  const { error } = await c.supabase.from('sugerencia').insert({
    perfil_id: c.perfilId,
    canto_id: c.cantoId,
    momento_id: c.momentoId,
    coro_id: c.coroId,
    misa_id: c.misaId,
  })

  if (error) {
    // 23505 es el índice único parcial: ya la había propuesto con este alcance.
    // No es un fallo que haya que explicar como error del sistema.
    if (error.code === '23505') return { ok: false, error: 'Ya la propusiste.' }
    return { ok: false, error: 'No pudimos guardar tu propuesta.' }
  }

  revalidatePath('/sugerencias')
  revalidatePath(`/repertorio/${c.cantoId}`)
  if (c.misaId) revalidatePath(`/misas/${c.misaId}`)
  return { ok: true }
}

export async function retirarSugerencia(raw: unknown): Promise<Resultado> {
  const c = await contexto(raw)
  if (!c.ok) return { ok: false, error: c.error }

  // Los `eq` sobre la fila propia no son redundantes con la RLS: son lo que
  // impide que un borrado mal armado dependa de la política para no llevarse la
  // de otro. La RLS es la seguridad; esto es no apoyarse solo en ella.
  let q = c.supabase
    .from('sugerencia')
    .delete()
    .eq('perfil_id', c.perfilId)
    .eq('canto_id', c.cantoId)
    .eq('momento_id', c.momentoId)

  // `= null` no encuentra nada en Postgres: la propuesta general se busca con
  // `is`, igual que la misa sin fecha en la semilla.
  q = c.misaId === null ? q.is('misa_id', null) : q.eq('misa_id', c.misaId)

  const { error } = await q
  if (error) return { ok: false, error: 'No pudimos retirar tu propuesta.' }

  revalidatePath('/sugerencias')
  revalidatePath(`/repertorio/${c.cantoId}`)
  if (c.misaId) revalidatePath(`/misas/${c.misaId}`)
  return { ok: true }
}
