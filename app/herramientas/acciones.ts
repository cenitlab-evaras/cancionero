'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { alternarHerramienta, esHerramienta, normalizarHerramientas } from '@/lib/motores/herramientas'

export type ResultadoHerramienta = { ok: true } | { ok: false; error: string }

const Entrada = z.object({ herramienta: z.string().refine(esHerramienta), prender: z.boolean() })

/**
 * Prende o apaga una herramienta para ESTA persona (2026-10-17). Como el
 * tamaño de letra: es de quien lee, vale en todo el repertorio y la fila es la
 * suya (`perfil_id` sale de la sesión, nunca del cliente).
 */
export async function guardarHerramienta(raw: unknown): Promise<ResultadoHerramienta> {
  const { herramienta, prender } = Entrada.parse(raw)
  if (!esHerramienta(herramienta)) return { ok: false, error: 'Esa herramienta no existe.' }

  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Tu sesión expiró. Vuelve a entrar.' }
  if (!puede(sesion.sujeto, 'guardar_preferencia_propia')) {
    return { ok: false, error: 'Tu cuenta todavía no está habilitada.' }
  }

  const supabase = await createClient()
  const { data } = await supabase.from('preferencias_perfil').select('herramientas').maybeSingle()
  const activas = alternarHerramienta(normalizarHerramientas(data?.herramientas), herramienta, prender)

  const { error } = await supabase.from('preferencias_perfil').upsert(
    { perfil_id: sesion.usuarioId, herramientas: activas, updated_at: new Date().toISOString() },
    { onConflict: 'perfil_id' }
  )
  if (error) return { ok: false, error: 'No se guardó el cambio. Revisa tu conexión.' }

  // Cambia cómo se ve cualquier canto: se revalida todo.
  revalidatePath('/', 'layout')
  return { ok: true }
}
