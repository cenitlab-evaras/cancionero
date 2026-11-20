import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Proxy (lo que hasta Next 15 se llamaba middleware).
 *
 * Su único trabajo acá es REFRESCAR el token de sesión y devolver las cookies
 * actualizadas. No es la autorización: eso lo deciden la RLS (los datos) y
 * `permisos.ts` (la pantalla). Cada ruta vuelve a comprobar la sesión con
 * `obtenerSesion()`, que es lo que garantiza que un usuario no aprobado no pase.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  // Refresca el token SOLO si está vencido (getSession lee las cookies y solo
  // va a la red cuando hace falta). Antes esto era getUser() en cada request:
  // un viaje a GoTrue por navegación que costaba 150-250 ms en producción
  // (2026-11-20). Acá no se autoriza nada: eso lo deciden la RLS y cada ruta.
  await supabase.auth.getSession()

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
