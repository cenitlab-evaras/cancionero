'use client'

import { useOptimistic, useState, useTransition } from 'react'
import type { Herramienta } from '@/lib/motores/herramientas'
import { guardarHerramienta } from './acciones'

/** Un interruptor de «Herramientas»: cambia al tocarlo y se guarda solo. */
export default function Interruptor({
  id,
  nombre,
  detalle,
  prendida,
}: {
  id: Herramienta
  nombre: string
  detalle: string
  prendida: boolean
}) {
  const [optimista, aplicar] = useOptimistic(prendida)
  const [, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function cambiar() {
    const nuevo = !optimista
    iniciar(async () => {
      aplicar(nuevo)
      const r = await guardarHerramienta({ herramienta: id, prender: nuevo })
      setError(r.ok ? null : r.error)
    })
  }

  return (
    <li className="py-1">
      <button
        type="button"
        role="switch"
        aria-checked={optimista}
        onClick={cambiar}
        className="tactil -mx-2 flex w-[calc(100%+1rem)] items-center gap-4 rounded-lg px-2 py-2.5 text-left hover:bg-superficie"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-base">{nombre}</span>
          <span className="block text-sm text-texto-tenue">{detalle}</span>
        </span>
        {/* El interruptor: la pastilla en el halo cuando está prendido. */}
        <span
          aria-hidden
          className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${
            optimista ? 'border-acento bg-acento' : 'border-borde-fuerte bg-superficie-alta'
          }`}
        >
          <span
            className={`absolute top-0.5 size-[1.375rem] rounded-full bg-fondo shadow transition-transform motion-reduce:transition-none ${
              optimista ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
            }`}
          />
        </span>
      </button>
      {error && (
        <p role="status" className="px-2 text-sm text-peligro">
          {error}
        </p>
      )}
    </li>
  )
}
