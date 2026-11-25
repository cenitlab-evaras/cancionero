'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { clasesBotonIcono } from '@/app/componentes/boton-icono'

/**
 * El destino del link que manda la invitación (2026-11-25; corregido en la
 * verificación de Task 8).
 *
 * Supabase Auth verifica el link del correo y devuelve la sesión en el
 * FRAGMENTO de la URL (`#access_token=…&refresh_token=…`), no como `?code=`.
 * El fragmento no viaja al servidor, así que esto tiene que ser una página de
 * cliente: acá se canjea por cookies de sesión con `setSession` y recién
 * entonces se navega a `/invitacion`. Antes era un `route.ts` con
 * `exchangeCodeForSession`, que nunca veía el código y terminaba en `/entrar`.
 *
 * También se acepta `?code=` (PKCE) y `?token_hash=…&type=…` por si el stack
 * cambia de flujo o se personaliza la plantilla del correo: las tres puertas
 * dejan la sesión en cookies antes de volver a la app.
 *
 * La invitación viaja en `inv`, el token crudo: se conserva tal cual para que
 * la pantalla de aceptación pueda pedirle a la RPC los datos del coro.
 *
 * Sin sesión que crear se manda a entrar y que la persona reabra el link del
 * correo, que es el único que trae un token válido.
 */

export default function ConfirmarPage() {
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    let vigente = true

    async function canjear() {
      const url = new URL(window.location.href)
      const inv = url.searchParams.get('inv') ?? ''
      const code = url.searchParams.get('code')
      const tokenHash = url.searchParams.get('token_hash')
      const tipo = url.searchParams.get('type')
      const fragmento = new URLSearchParams(url.hash.replace(/^#/, ''))
      const accessToken = fragmento.get('access_token')
      const refreshToken = fragmento.get('refresh_token')

      const destino = inv ? `/invitacion?inv=${encodeURIComponent(inv)}` : '/invitacion'
      const alEntrar = () => {
        if (vigente) window.location.replace(destino)
      }
      const aEntrar = () => {
        if (vigente) window.location.replace('/entrar')
      }

      const supabase = createClient()

      // 1 · Flujo real del Auth self-hosted: tokens en el fragmento.
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        return error ? aEntrar() : alEntrar()
      }

      // 2 · PKCE: `?code=` en la query.
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        return error ? aEntrar() : alEntrar()
      }

      // 3 · Plantilla propia con `token_hash` y `type`.
      if (tokenHash && tipo) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: tipo as 'invite' | 'magiclink' | 'recovery' | 'email' | 'email_change',
        })
        return error ? aEntrar() : alEntrar()
      }

      aEntrar()
    }

    canjear().catch(() => {
      if (vigente) {
        setAviso('No pudimos abrir el link. Vuelve a intentarlo desde el correo.')
      }
    })

    return () => {
      vigente = false
    }
  }, [])

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
      <h1 className="titulo-libro text-[2.25rem] leading-tight">Invitación</h1>
      <p className="mt-4 text-base leading-relaxed text-texto-tenue">
        {aviso ?? 'Verificando el link…'}
      </p>
      {aviso && (
        <Link href="/entrar" className={clasesBotonIcono('lleno', 'mt-8 px-4 text-base')}>
          Entrar
        </Link>
      )}
    </main>
  )
}
