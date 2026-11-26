'use client'

import { useId, useOptimistic, useState, useTransition, type ReactNode } from 'react'
import type { Herramienta } from '@/lib/motores/herramientas'
import { guardarHerramienta } from './acciones'

/**
 * Una celda de la caja de herramientas (rediseño de la caja, 2026-11-25): el
 * ícono y el interruptor arriba, el nombre abajo, y toda la celda se toca.
 *
 * El detalle de cada herramienta no se dibuja para que las cuatro entren en
 * dos cajas por uso; queda como descripción accesible (`aria-description`)
 * para quien navega con lector de pantalla. La celda entera es el interruptor:
 * `role="switch"` con `aria-checked`, no un botón chico dentro de la fila.
 *
 * Se pinta al instante y se confirma contra el servidor; si falla, vuelve y se
 * dice abajo. Misma lógica que la fila anterior de «Herramientas».
 */
export default function Celda({
  id,
  nombre,
  detalle,
  icono,
  prendida,
}: {
  id: Herramienta
  nombre: string
  detalle: string
  icono: ReactNode
  prendida: boolean
}) {
  const descripcionId = useId()
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
    <div className={optimista ? 'bg-superficie-alta' : 'bg-superficie'}>
      <button
        type="button"
        role="switch"
        aria-checked={optimista}
        aria-label={nombre}
        aria-describedby={descripcionId}
        onClick={cambiar}
        className="tactil flex h-full w-full flex-col items-stretch gap-2.5 p-3 text-left"
      >
        <span className="flex items-center justify-between gap-2">
          <span className={optimista ? 'text-texto' : 'text-texto-tenue'}>{icono}</span>
          {/* El interruptor: la superficie alta y la perilla dicen el estado. */}
          <span
            aria-hidden
            className={`relative h-7 w-12 shrink-0 rounded-full border border-borde-fuerte transition-colors ${
              optimista ? 'bg-superficie-alta' : 'bg-superficie'
            }`}
          >
            <span
              className={`absolute top-0.5 size-[1.375rem] rounded-full shadow transition-transform motion-reduce:transition-none ${
                optimista ? 'translate-x-[1.375rem] bg-texto' : 'translate-x-0.5 bg-texto-tenue'
              }`}
            />
          </span>
        </span>
        <span className="text-[0.9375rem] font-semibold leading-tight">{nombre}</span>
        <span id={descripcionId} className="sr-only">
          {detalle}
        </span>
      </button>
      {error && (
        <p role="status" className="px-3 pb-2 text-sm text-peligro">
          {error}
        </p>
      )}
    </div>
  )
}
