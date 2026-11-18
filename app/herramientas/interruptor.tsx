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
        {/* El interruptor: encendido es superficie alta y perilla de texto, la
            semántica que DESIGN.md da a `activo`. El halo queda para la marca y
            la acción principal; con cuatro encendidos a la vez dejaba de ser la
            firma del coro. La posición y el color de la perilla dicen el estado. */}
        <span
          aria-hidden
          className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${
            optimista ? 'border-borde-fuerte bg-superficie-alta' : 'border-borde-fuerte bg-superficie'
          }`}
        >
          <span
            className={`absolute top-0.5 size-[1.375rem] rounded-full shadow transition-transform motion-reduce:transition-none ${
              optimista ? 'translate-x-[1.375rem] bg-texto' : 'translate-x-0.5 bg-texto-tenue'
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
