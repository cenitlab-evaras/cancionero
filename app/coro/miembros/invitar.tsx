'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { invitarMiembro } from '@/app/invitaciones/acciones'
import TituloSeccion from '@/app/componentes/titulo-seccion'
import { clasesBotonIcono } from '@/app/componentes/boton-icono'

/**
 * Invitar a un miembro del coro (2026-11-25).
 *
 * El formulario no elige rol: el director solo invita MIEMBROS; invitar a otro
 * director es del admin. La action vuelve a comprobarlo, y la RLS decide al
 * insertar. Acá solo se muestra el motivo cuando dice que no.
 */
export default function Invitar() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviada, setEnviada] = useState(false)
  const [pendiente, empezar] = useTransition()

  function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setEnviada(false)
    empezar(async () => {
      const r = await invitarMiembro({ email })
      if (!r.ok) {
        setError(r.error ?? 'No pudimos enviar la invitación.')
        return
      }
      setEnviada(true)
      setEmail('')
      router.refresh()
    })
  }

  return (
    <section className="mt-6">
      <TituloSeccion>Invitar al coro</TituloSeccion>
      <p className="mt-1 max-w-prose text-sm text-texto-tenue">
        Le llega un correo con un enlace para entrar y quedar como miembro del coro.
      </p>

      <form onSubmit={enviar} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="correo@ejemplo.cl"
          aria-label="Correo de la persona a invitar"
          autoComplete="email"
          disabled={pendiente}
          className="tactil min-w-0 flex-1 rounded-lg border border-borde-fuerte bg-superficie px-3 text-base placeholder:text-texto-tenue focus:border-acento disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={pendiente || email.trim() === ''}
          className={clasesBotonIcono('lleno', 'px-4 text-sm')}
        >
          Invitar al coro
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-2 text-sm text-peligro">
          {error}
        </p>
      )}
      {enviada && (
        <p role="status" className="mt-2 text-sm text-texto-tenue">
          Invitación enviada.
        </p>
      )}
    </section>
  )
}
