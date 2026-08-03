'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Único Client Component de la entrada: Auth necesita correr en el navegador
 * para que la sesión quede en las cookies.
 */
export default function FormularioEntrar() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setCargando(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('No pudimos entrar con ese correo y contraseña.')
      setCargando(false)
      return
    }

    // La raíz decide a dónde va cada uno, con rutaInicial().
    router.replace('/')
    router.refresh()
  }

  const campo =
    'h-11 rounded-lg border border-borde-fuerte bg-superficie px-3 text-texto transition-colors placeholder:text-texto-tenue hover:border-texto-tenue focus:border-acento'

  return (
    <form onSubmit={entrar} className="mt-8 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-texto-tenue">Correo</span>
        <input
          type="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={campo}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-texto-tenue">Contraseña</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={campo}
        />
      </label>

      {error && (
        <p role="alert" className="text-sm text-peligro">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={cargando}
        className="tactil mt-2 rounded-lg bg-acento px-4 font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {cargando ? 'Entrando…' : 'Entrar'}
      </button>
    </form>
  )
}
