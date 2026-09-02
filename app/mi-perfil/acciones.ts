'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { DISPONIBILIDADES, TESITURAS } from '@/lib/motores/ficha'

/**
 * El perfil propio (H14).
 *
 * Solo hay UNA acción y escribe SOLO la fila de quien pregunta: el `perfil_id`
 * sale de la sesión, nunca del formulario. Aunque alguien mande otro en el POST,
 * no hay dónde ponerlo — y si lo hubiera, `ficha_miembro_write` lo rechazaría.
 *
 * Como en el resto (§8.3), se comprueba la capacidad en el servidor ADEMÁS de
 * la RLS: la RLS impide el dato, esto convierte su rechazo mudo en un motivo.
 */

export type Resultado = { ok: true } | { ok: false; error: string }

/**
 * Los tres campos son opcionales y el vacío se guarda como `null`.
 *
 * Un perfil a medias es más útil que ninguno, y obligar a declarar el
 * nacimiento para elegir tesitura dejaría al coro sin cargar nada.
 */
const vacioANull = (v: unknown) => (v === '' || v === undefined ? null : v)

const Ficha = z.object({
  fechaNacimiento: z.preprocess(
    vacioANull,
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha tiene que ser un día del calendario.')
      .nullable()
  ),
  tesitura: z.preprocess(vacioANull, z.enum(TESITURAS).nullable()),
  disponibilidad: z.preprocess(vacioANull, z.enum(DISPONIBILIDADES).nullable()),
})

export async function guardarMiFicha(raw: unknown): Promise<Resultado> {
  const datos = Ficha.safeParse(raw)
  if (!datos.success) {
    return { ok: false, error: datos.error.issues[0]?.message ?? 'Revisa los datos.' }
  }

  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Sesión expirada. Volvé a entrar.' }
  if (!sesion.coroActivo) return { ok: false, error: 'No tienes un coro activo.' }
  if (!puede(sesion.sujeto, 'editar_ficha_propia')) {
    return { ok: false, error: 'No tienes permiso para cargar tu perfil en este coro.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('ficha_miembro').upsert(
    {
      perfil_id: sesion.usuarioId,
      coro_id: sesion.coroActivo.id,
      fecha_nacimiento: datos.data.fechaNacimiento,
      tesitura: datos.data.tesitura,
      disponibilidad: datos.data.disponibilidad,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'perfil_id,coro_id' }
  )

  if (error) return { ok: false, error: 'No se pudo guardar tu perfil.' }

  revalidatePath('/mi-perfil')
  revalidatePath('/coro/miembros')
  return { ok: true }
}
