'use client'

import { useRouter } from 'next/navigation'
import { useOptimistic, useState, useTransition } from 'react'
import {
  QUIENES,
  esQuienCanta,
  estrofasDe,
  huellaDeEstrofa,
  nombreDeQuienCanta,
  type QuienCanta,
} from '@/lib/motores/quien-canta'
import { marcarQuienCanta } from './acciones'

/**
 * «Quién canta cada estrofa», para el director, AL PIE de la ficha (2026-11-17).
 *
 * Antes cada estrofa llevaba su `<select>` dentro del cifrado, entre el título
 * y el primer acorde: planificación justo donde se toca. DESIGN.md manda la
 * planificación al pie, así que acá está la misma rueda nativa del sistema,
 * ordenada como se lee el canto. El cifrado solo dibuja el rótulo.
 */
export default function MarcarQuienCanta({ cantoId, cifrado }: { cantoId: string; cifrado: string }) {
  const estrofas = estrofasDe(cifrado)
  if (estrofas.length === 0) return null

  return (
    <div>
      <p className="text-sm font-bold">Quién canta cada estrofa</p>
      <ul className="mt-1 divide-y divide-borde border-t border-borde">
        {estrofas.map((e, i) => (
          <FilaMarcado
            key={i}
            cantoId={cantoId}
            indice={i}
            huella={huellaDeEstrofa(cifrado, i)}
            canta={e.canta}
          />
        ))}
      </ul>
    </div>
  )
}

function FilaMarcado({
  cantoId,
  indice,
  huella,
  canta,
}: {
  cantoId: string
  indice: number
  huella: string | null
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
      const r = await marcarQuienCanta({ cantoId, estrofa: indice, huella: huella ?? '', canta: nuevo })
      if (!r.ok) setError(r.error)
      router.refresh()
    })
  }

  return (
    <li className="flex min-h-11 items-center gap-3 py-1">
      <span className="min-w-0 flex-1 truncate text-sm text-texto-tenue">
        <span className="font-bold text-texto">{indice + 1}</span>
        {huella ? ` · ${huella}` : null}
      </span>
      <select
        value={optimista ?? ''}
        onChange={(e) => cambiar(e.target.value)}
        aria-label={`Quién canta la estrofa ${indice + 1}`}
        className={`control-estrofa max-w-40 shrink-0 cursor-pointer rounded border border-borde-fuerte bg-fondo px-1.5 py-1.5 text-sm font-bold ${
          optimista ? 'text-texto' : 'border-dashed font-normal text-texto-tenue'
        }`}
      >
        <option value="">Sin marcar</option>
        {QUIENES.map((q) => (
          <option key={q} value={q}>
            {nombreDeQuienCanta(q)}
          </option>
        ))}
      </select>
      {error && (
        <span role="alert" className="shrink-0 text-sm text-peligro">
          {error}
        </span>
      )}
    </li>
  )
}
