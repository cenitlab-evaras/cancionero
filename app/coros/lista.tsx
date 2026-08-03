'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import type { CoroDelUsuario } from '@/lib/sesion'
import { fijarCoroActivo } from '@/app/componentes/acciones'

export default function ListaCoros({
  coros,
  activoId,
}: {
  coros: CoroDelUsuario[]
  activoId: string
}) {
  const router = useRouter()
  const [pendiente, iniciarTransicion] = useTransition()

  function activar(coroId: string) {
    iniciarTransicion(async () => {
      const r = await fijarCoroActivo({ coroId })
      if (r.ok) router.push('/repertorio')
    })
  }

  return (
    <ul className="mt-4">
      {coros.map((coro) => {
        const activo = coro.id === activoId
        return (
          <li key={coro.id} className="border-b border-borde/70 last:border-b-0">
            <button
              onClick={() => activar(coro.id)}
              disabled={pendiente}
              className="tactil -mx-2 flex w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-left hover:bg-superficie disabled:opacity-60"
            >
              <span className="min-w-0">
                <span className="block truncate">{coro.nombre}</span>
                <span className="block truncate text-xs text-texto-tenue">
                  {coro.parroquia ? `${coro.parroquia} · ` : ''}
                  {coro.rolLocal}
                </span>
              </span>
              {activo && <span className="shrink-0 text-xs text-exito">activo</span>}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
