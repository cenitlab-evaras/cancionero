'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import type { CoroDelUsuario } from '@/lib/sesion'
import { fijarCoroActivo } from './acciones'

export default function SelectorCoro({
  coros,
  activoId,
}: {
  coros: CoroDelUsuario[]
  activoId: string
}) {
  const router = useRouter()
  const [pendiente, iniciarTransicion] = useTransition()

  function cambiar(coroId: string) {
    iniciarTransicion(async () => {
      await fijarCoroActivo({ coroId })
      router.refresh()
    })
  }

  return (
    <select
      aria-label="Coro activo"
      value={activoId}
      disabled={pendiente}
      onChange={(e) => cambiar(e.target.value)}
      className="tactil rounded-lg border border-borde bg-superficie px-2 text-sm text-texto"
    >
      {coros.map((coro) => (
        <option key={coro.id} value={coro.id}>
          {coro.nombre}
        </option>
      ))}
    </select>
  )
}
