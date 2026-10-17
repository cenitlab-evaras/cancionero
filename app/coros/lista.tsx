'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
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
  // Antes un rechazo de la action no se veía: el toque no hacía nada.
  const [error, setError] = useState<string | null>(null)

  function activar(coroId: string) {
    setError(null)
    iniciarTransicion(async () => {
      const r = await fijarCoroActivo({ coroId })
      if (r.ok) router.push('/repertorio')
      else setError(r.error)
    })
  }

  return (
    <>
      {error && (
        <p role="status" className="mt-4 text-sm text-peligro">
          {error}
        </p>
      )}
      <ul className="mt-4 border-t border-borde">
        {coros.map((coro) => {
          const activo = coro.id === activoId
          return (
            <li key={coro.id} className="border-b border-borde">
              <button
                type="button"
                onClick={() => activar(coro.id)}
                aria-current={activo ? 'true' : undefined}
                disabled={pendiente}
                className="tactil -mx-2 flex w-full items-center justify-between gap-3 rounded-lg px-2 py-3 text-left hover:bg-superficie disabled:opacity-60"
              >
                <span className="min-w-0">
                  <span className="block truncate">{coro.nombre}</span>
                  {coro.parroquia && (
                    <span className="block truncate text-sm text-texto-tenue">
                      {coro.parroquia}
                    </span>
                  )}
                  <span className="block text-sm text-texto-tenue capitalize">{coro.rolLocal}</span>
                </span>
                {/* El lugar activo va en el halo, como en la barra de abajo. */}
                {activo && (
                  <span className="shrink-0 text-sm font-semibold text-acento">Activo</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}
