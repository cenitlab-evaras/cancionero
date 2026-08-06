'use client'

import { useState, useTransition } from 'react'
import { crearCelebracion } from '../acciones'

const CAMPO =
  'h-11 rounded-lg border border-borde-fuerte bg-superficie px-3 text-texto transition-colors placeholder:text-texto-tenue hover:border-texto-tenue focus:border-acento'

export default function FormularioCelebracion() {
  const [nombre, setNombre] = useState('')
  const [fecha, setFecha] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    empezar(async () => {
      // La acción redirige sola cuando sale bien; si vuelve, es que falló.
      const r = await crearCelebracion({ nombre, fecha })
      if (r && !r.ok) setError(r.error)
    })
  }

  return (
    <form onSubmit={guardar} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-texto-tenue">Nombre</span>
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Misa del domingo"
          required
          className={CAMPO}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-texto-tenue">Fecha</span>
        <input
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className={CAMPO}
        />
        {/* Sin fecha también vale: un ensayo o una lista de trabajo no la tiene
            (PRD §18-6). Se dice acá para que el campo vacío no parezca un olvido. */}
        <span className="text-[0.6875rem] text-texto-tenue">
          Puedes dejarla vacía si todavía no sabes cuándo es.
        </span>
      </label>

      {error && <p className="text-sm text-peligro">{error}</p>}

      <button
        type="submit"
        disabled={pendiente || nombre.trim() === ''}
        className="tactil mt-2 rounded-lg bg-acento font-medium text-white disabled:opacity-40"
      >
        {pendiente ? 'Creando…' : 'Crear'}
      </button>
    </form>
  )
}
