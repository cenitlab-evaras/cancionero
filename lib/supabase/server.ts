import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Cliente de SERVIDOR. El default para casi todo.
 *
 * Arrastra la sesión del usuario, así que la RLS decide qué filas salen. En
 * Next 16 `cookies()` es asíncrono, por eso esta función es async y HAY QUE
 * AWAIT-EARLA siempre: `const supabase = await createClient()`.
 *
 * Trabaja sobre el esquema dedicado `cantoral`, nunca sobre `public`.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      db: { schema: 'cantoral' },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Llamado desde un Server Component: el refresco de sesión lo hace
            // el proxy. Ignorar es correcto acá.
          }
        },
      },
    }
  )
}
