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

  // Refresca el token si hace falta. No se usa el resultado para autorizar.
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
