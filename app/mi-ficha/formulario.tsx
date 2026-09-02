'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DISPONIBILIDADES,
  TESITURAS,
  etiquetaDisponibilidad,
  etiquetaTesitura,
} from '@/lib/motores/ficha'
import { guardarMiFicha } from './acciones'
import type { FichaPropia } from '@/lib/datos/ficha'

/**
 * H14 · el formulario de la ficha propia.
 *
 * Los tres campos son opcionales a propósito: se puede guardar solo la tesitura
 * y volver por el resto. Las etiquetas salen del motor, no de acá, para que
 * /mi-ficha y /coro/miembros digan exactamente lo mismo.
 */
export default function FormularioFicha({ ficha }: { ficha: FichaPropia | null }) {
  const router = useRouter()
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [guardado, setGuardado] = useState(false)

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    setGuardado(false)

    const form = new FormData(e.currentTarget)
    const resultado = await guardarMiFicha({
      fechaNacimiento: form.get('fechaNacimiento'),
      tesitura: form.get('tesitura'),
      disponibilidad: form.get('disponibilidad'),
    })

    setGuardando(false)
    if (resultado.ok) {
      setGuardado(true)
      router.refresh()
    } else {
      setError(resultado.error)
    }
  }

  return (
    <form onSubmit={enviar} className="mt-6 space-y-5">
      <div>
        <label htmlFor="fechaNacimiento" className="block text-sm font-medium">
          Fecha de nacimiento
        </label>
        <input
          id="fechaNacimiento"
          name="fechaNacimiento"
          type="date"
          defaultValue={ficha?.fechaNacimiento ?? ''}
          className="mt-1 w-full rounded-md border border-borde bg-fondo-suave px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-texto-tenue">
          Solo se guarda el día: la edad se calcula cada vez que se mira.
        </p>
      </div>

      <div>
        <label htmlFor="tesitura" className="block text-sm font-medium">
          En qué tono cantas
        </label>
        <select
          id="tesitura"
          name="tesitura"
          defaultValue={ficha?.tesitura ?? ''}
          className="mt-1 w-full rounded-md border border-borde bg-fondo-suave px-3 py-2 text-sm"
        >
          <option value="">Sin declarar</option>
          {TESITURAS.map((t) => (
            <option key={t} value={t}>
              {etiquetaTesitura(t)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="disponibilidad" className="block text-sm font-medium">
          Con qué frecuencia puedes cantar
        </label>
        <select
          id="disponibilidad"
          name="disponibilidad"
          defaultValue={ficha?.disponibilidad ?? ''}
          className="mt-1 w-full rounded-md border border-borde bg-fondo-suave px-3 py-2 text-sm"
        >
          <option value="">Sin declarar</option>
          {DISPONIBILIDADES.map((d) => (
            <option key={d} value={d}>
              {etiquetaDisponibilidad(d)}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p role="alert" className="text-sm text-peligro">
          {error}
        </p>
      )}
      {guardado && !error && (
        <p role="status" className="text-sm text-texto-tenue">
          Ficha guardada.
        </p>
      )}

      <button
        type="submit"
        disabled={guardando}
        className="w-full rounded-md bg-acento px-4 py-2.5 text-sm font-medium text-fondo disabled:opacity-60"
      >
        {guardando ? 'Guardando…' : 'Guardar mi ficha'}
      </button>
    </form>
  )
}
