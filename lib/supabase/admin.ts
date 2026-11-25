import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente ADMIN — SALTEA LA RLS.
 *
 * Usos en este producto:
 * - El script de semilla, que crea los usuarios de Auth y carga el repertorio
 *   antes de que exista nadie que pueda hacerlo con permisos.
 * - La action de invitar (`app/invitaciones/acciones.ts`), que necesita
 *   `auth.admin.inviteUserByEmail`. Es la única excepción aprobada: corre solo
 *   en el servidor, nunca en el cliente, y recién después de validar la
 *   capacidad y el coro (docs/superpowers/specs/2026-11-25-invitaciones-design.md §6).
 *
 * Fuera de esos dos casos, NUNCA para una operación de usuario. Si te
 * descubrís usándolo para que algo "ande", lo que falta es una política
 * (PRD §8.3).
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
