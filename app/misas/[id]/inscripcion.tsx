'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { guardarMiInscripcion, retirarMiInscripcion } from '../acciones'
import { INSTRUMENTOS, nombreInstrumento, type Aporte } from '@/lib/motores/inscripcion'

/**
 * «Voy» — la declaración de una persona sobre una misa (H15).
 *
 * Va PRIMERO, antes de la lista de quién va: lo que uno viene a hacer acá es
 * anotarse, y leer quién más se anotó es la consecuencia, no el objetivo.
 *
 * El instrumento aparece solo al elegir «Toco». Es la condicionalidad de B2
 * dibujada: dos campos siempre visibles obligarían a mirar uno que no aplica, y
 * dejarían la puerta abierta a mandar los dos, que es justo lo que el `check`
 * de la base rechaza.
 */
export default function Inscripcion({
  misaId,
  mia,
  editable,
}: {
  misaId: string
  mia: { aporte: Aporte; instrumento: string | null } | null
  /** Falso en una misa que ya ocurrió: se lee, no se cambia. */
  editable: boolean
}) {
  const router = useRouter()
  const [aporte, setAporte] = useState<Aporte>(mia?.aporte ?? 'vocal')
  const [instrumento, setInstrumento] = useState<string>(mia?.instrumento ?? 'guitarra')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()

  function correr(accion: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    empezar(async () => {
      const r = await accion()
      if (!r.ok) {
        setError(r.error ?? 'No pudimos guardar.')
        return
      }
      router.refresh()
    })
  }

  if (!editable) {
    return (
      <p className="mt-2 text-sm text-texto-tenue">
        {mia
          ? `Fuiste a esta misa ${mia.aporte === 'vocal' ? 'a cantar' : `con ${nombreInstrumento(mia.instrumento).toLowerCase()}`}.`
          : 'Esta misa ya pasó.'}
      </p>
    )
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm text-texto-tenue">Voy ·</span>
        {(['vocal', 'instrumental'] as const).map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setAporte(a)}
            aria-pressed={aporte === a}
            className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              aporte === a
                ? 'border-acento bg-superficie-alta text-texto'
                : 'border-borde text-texto-tenue hover:border-borde-fuerte'
            }`}
          >
            {a === 'vocal' ? 'Canto' : 'Toco'}
          </button>
        ))}

        {aporte === 'instrumental' && (
          <select
            value={instrumento}
            onChange={(e) => setInstrumento(e.target.value)}
            aria-label="Qué instrumento vas a tocar"
            className="tactil rounded-lg border border-borde-fuerte bg-superficie px-2 text-sm"
          >
            {INSTRUMENTOS.map((i) => (
              <option key={i} value={i}>
                {nombreInstrumento(i)}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            correr(() =>
              guardarMiInscripcion(misaId, {
                aporte,
                instrumento: aporte === 'instrumental' ? instrumento : null,
              })
            )
          }
          className="tactil rounded-lg bg-acento px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          {mia ? 'Cambiar' : 'Anotarme'}
        </button>

        {mia && (
          // Retirarse no es destructivo —nadie pierde nada— así que no lleva el
          // color de peligro ni confirmación: se vuelve a anotar en un toque.
          <button
            type="button"
            disabled={pendiente}
            onClick={() => correr(() => retirarMiInscripcion(misaId))}
            className="tactil rounded-lg px-3 text-sm text-texto-tenue disabled:opacity-40"
          >
            No voy
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-2 text-sm text-peligro">
          {error}
        </p>
      )}
    </div>
  )
}
