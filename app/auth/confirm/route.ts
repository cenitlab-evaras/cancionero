import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * El destino del link que manda la invitación (2026-11-25).
 *
 * Supabase Auth devuelve acá un `code` que hay que canjear por una sesión. La
 * invitación viaja en `inv`, el token crudo: se conserva tal cual para que la
 * pantalla de aceptación pueda pedirle a la RPC los datos del coro.
 *
 * SIN `code` no hay sesión que crear y SIN sesión no se acepta una invitación
 * (ruling del controlador): se manda a entrar y que la persona reabra el link
 * del correo, que es el único que trae un código válido.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const inv = searchParams.get('inv') ?? ''

  if (!code) {
    return NextResponse.redirect(new URL('/entrar', request.url))
  }

  // El redirect se crea ANTES de canjear el código: las cookies de sesión que
  // devuelve Supabase tienen que viajar en ESTA respuesta, no en el request.
  const response = NextResponse.redirect(
    new URL(`/invitacion?inv=${encodeURIComponent(inv)}`, request.url)
  )

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    }
  )

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(new URL('/entrar', request.url))
  }

  return response
}
