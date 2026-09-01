import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente ADMIN — SALTEA LA RLS.
 *
 * Uso justificado y único en este producto: el script de semilla, que crea los
 * usuarios de Auth y carga el repertorio antes de que exista nadie que pueda
 * hacerlo con permisos.
 *
 * NUNCA para una operación de usuario. Si te descubrís usándolo para que algo
 * "ande", lo que falta es una política (PRD §8.3).
 *
 * La clave secreta vive solo del lado del servidor, sin prefijo NEXT_PUBLIC_ y
 * fuera del repo (PRD decisión 9).
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.SUPABASE_SECRET_KEY

  if (!url || !secret) {
    throw new Error(
      'Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY. Copiá .env.example a .env.local.'
    )
  }

  return createSupabaseClient(url, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
