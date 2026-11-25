'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { aceptarInvitacion } from '@/app/invitaciones/acciones'
import { clasesBotonIcono } from '@/app/componentes/boton-icono'

/**
 * La isla de la aceptación: contraseña (solo si la cuenta es nueva) y el botón
 * que llama a la RPC. La RLS y la RPC vuelven a decidir; acá solo se avisa.
 *
 * «Cuenta nueva» es `invited_at` con valor: la creó `inviteUserByEmail` y
 * todavía no tiene contraseña. La cuenta existente llegó por link mágico y ya
 * entra con la suya.
 */
export default function FormularioInvitacion({ inv, nuevo }: { inv: string; nuevo: boolean }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [repetir, setRepetir] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function unirse(e: React.FormEvent) {
    e.preventDefault()
    if (cargando) return
    setError(null)

    if (nuevo) {
      if (password.length < 8) {
        setError('La contraseña necesita al menos 8 caracteres.')
        return
      }
      if (password !== repetir) {
        setError('Las contraseñas no coinciden.')
        return
      }
    }

    setCargando(true)

    // Primero la contraseña, para que la próxima entrada no dependa de otro
    // correo. Si falla, no se acepta nada: la invitación sigue pendiente.
    if (nuevo) {
      const supabase = createClient()
      const { error: errorContrasena } = await supabase.auth.updateUser({ password })

      if (errorContrasena) {
        setError('No pudimos guardar tu contraseña. Intenta de nuevo.')
        setCargando(false)
        return
      }
    }

    const resultado = await aceptarInvitacion(inv)

    if (!resultado.ok) {
      setError(resultado.error)
      setCargando(false)
      return
    }

    // La raíz reparte con rutaInicial(): ya aprobado y con coro, entra directo.
    router.replace('/')
    router.refresh()
  }

  const campo =
    'tactil rounded-lg border border-borde-fuerte bg-superficie px-3 text-base text-texto transition-colors placeholder:text-texto-tenue hover:border-texto-tenue focus:border-acento'

  return (
    <form onSubmit={unirse} className="mt-8 flex flex-col gap-4">
      {nuevo && (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-texto-tenue">Contraseña</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={campo}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-texto-tenue">Repite la contraseña</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={repetir}
              onChange={(e) => setRepetir(e.target.value)}
              className={campo}
            />
          </label>

          <p className="text-sm leading-relaxed text-texto-tenue">
            La usarás para entrar la próxima vez. Mínimo 8 caracteres.
          </p>
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-peligro">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={cargando}
        className={clasesBotonIcono('lleno', 'mt-2 px-4 text-base')}
      >
        {cargando ? 'Uniéndote…' : 'Unirme al coro'}
      </button>
    </form>
  )
}
