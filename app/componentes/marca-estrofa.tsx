'use client'

import { useRouter } from 'next/navigation'
import { useOptimistic, useState, useTransition } from 'react'
import { QUIENES, esQuienCanta, nombreDeQuienCanta, type QuienCanta } from '@/lib/motores/quien-canta'
import { marcarQuienCanta } from '@/app/repertorio/[cantoId]/acciones'

/**
 * Lo que ve el DIRECTOR sobre cada estrofa con «Quién canta» prendida: el
 * mismo rótulo que ven todos, pero se puede cambiar (2026-10-17). Es un
 * `<select>` nativo: en el teléfono abre la rueda del sistema, que es lo que
 * mejor se toca de pie con la guitarra colgada.
 */
export default function MarcaEstrofa({
  cantoId,
  estrofa,
  huella,
  canta,
}: {
  cantoId: string
  estrofa: number
  huella: string
  canta: QuienCanta | null
}) {
  const router = useRouter()
  const [, iniciar] = useTransition()
  const [optimista, aplicar] = useOptimistic(canta)
  const [error, setError] = useState<string | null>(null)

  function cambiar(valor: string) {
    const nuevo = esQuienCanta(valor) ? valor : null
    setError(null)
    iniciar(async () => {
      aplicar(nuevo)
      const r = await marcarQuienCanta({ cantoId, estrofa, huella, canta: nuevo })
      if (!r.ok) setError(r.error)
      router.refresh()
    })
  }

  return (
    <span className="inline-flex flex-wrap items-baseline gap-x-2">
      <select
        value={optimista ?? ''}
        onChange={(e) => cambiar(e.target.value)}
        aria-label={`Quién canta la estrofa ${estrofa + 1}`}
        className={`-my-1 cursor-pointer rounded border border-borde bg-fondo py-1 pr-1 pl-1.5 font-bold ${
          optimista ? 'text-texto-tenue' : 'border-dashed font-normal text-texto-tenue'
        }`}
      >
        <option value="">¿Quién canta?</option>
        {QUIENES.map((q) => (
          <option key={q} value={q}>
            {nombreDeQuienCanta(q)}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" className="text-peligro">
          {error}
        </span>
      )}
    </span>
  )
}
