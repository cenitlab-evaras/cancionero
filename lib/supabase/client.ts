import { createBrowserClient } from '@supabase/ssr'

/**
 * Cliente de NAVEGADOR. Solo para Client Components que necesitan hablar con
 * Supabase en vivo — en H1, únicamente el formulario de entrar.
 *
 * También arrastra la sesión, así que la RLS sigue mandando.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { db: { schema: 'cantoral' } }
  )
}
