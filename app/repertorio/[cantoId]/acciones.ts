'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { normalizarSemitonos } from '@/lib/motores/transponer'

/**
 * Guarda la preferencia de lectura del usuario para un canto (H3).
 *
 * Una server action es alcanzable por POST directo, no solo desde la UI, así
 * que valida la entrada con Zod y comprueba el rol en el servidor ADEMÁS de la
 * RLS. Sin esa comprobación previa, la RLS rechazaría en silencio con cero
 * filas afectadas y el usuario creería que guardó (PRD §8.3).
 */

const Entrada = z.object({
  cantoId: z.string().uuid(),
  coroId: z.string().uuid(),
  transposicion: z.number().int().min(-11).max(11),
  tamanoLetra: z
    .number()
    .int()
    .min(14)
    .max(24)
    .refine((n) => n % 2 === 0, 'El tamaño va en pasos de 2 (RN-14)'),
})

export type ResultadoPreferencia = { ok: true } | { ok: false; error: string }

export async function guardarPreferencia(raw: unknown): Promise<ResultadoPreferencia> {
  const datos = Entrada.parse(raw)

  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Sesión expirada. Volvé a entrar.' }

  if (!puede(sesion.sujeto, 'guardar_preferencia_propia')) {
    return { ok: false, error: 'Tu cuenta todavía no está habilitada.' }
  }

  const supabase = await createClient()

  // `perfil_id` sale de la sesión, NUNCA del cliente: si viniera en la entrada,
  // cualquiera podría escribir la preferencia de otro. La RLS igual lo frena,
  // pero no se le deja ni intentarlo.
  const { error } = await supabase.from('preferencias_lectura').upsert(
    {
      perfil_id: sesion.usuarioId,
      canto_id: datos.cantoId,
      coro_id: datos.coroId,
      transposicion: normalizarSemitonos(datos.transposicion),
      tamano_letra: datos.tamanoLetra,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'perfil_id,canto_id' }
  )

  if (error) return { ok: false, error: 'No pudimos guardar tu preferencia.' }

  revalidatePath(`/repertorio/${datos.cantoId}`)
  return { ok: true }
}

/**
 * Guarda si esta PERSONA quiere ver los acordes (H11).
 *
 * No lleva `cantoId` en la entrada porque la preferencia no es de un canto: es
 * de quien lee, y vale en todo el repertorio. Por eso tampoco lleva `coroId`:
 * la fila no cuelga de ningún coro y no hay alcance que comprobar.
 *
 * Se revalida el layout entero —no una ruta— porque el cambio afecta cualquier
 * canto que se abra después, no solo el que estaba en pantalla.
 */
export async function guardarMostrarAcordes(valor: unknown): Promise<ResultadoPreferencia> {
  const mostrar = z.boolean().parse(valor)

  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Sesión expirada. Volvé a entrar.' }

  if (!puede(sesion.sujeto, 'guardar_preferencia_propia')) {
    return { ok: false, error: 'Tu cuenta todavía no está habilitada.' }
  }

  const supabase = await createClient()

  // `perfil_id` sale de la sesión, nunca del cliente (igual que en H3).
  const { error } = await supabase.from('preferencias_perfil').upsert(
    {
      perfil_id: sesion.usuarioId,
      mostrar_acordes: mostrar,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'perfil_id' }
  )

  if (error) return { ok: false, error: 'No pudimos guardar tu preferencia.' }

  revalidatePath('/repertorio', 'layout')
  return { ok: true }
}
