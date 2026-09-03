'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { retirarSugerencia, sugerirCanto } from '../sugerir'
import { yaSugirio, type Sugerencia } from '@/lib/motores/sugerencia'

/**
 * Proponer este canto (H17).
 *
 * VIVE FUERA DE LA ZONA DE LECTURA. El cifrado es el producto (§PRODUCT) y
 * todo lo que no es acorde o letra tiene que justificarse: este control se toca
 * sentado, planificando, no de pie con la guitarra puesta. Por eso va arriba
 * del cifrado y no en la barra inferior, que es la que se usa MIENTRAS se canta.
 *
 * EL ALCANCE ES UN SELECTOR Y NO DOS BOTONES porque el dueño pidió las dos
 * cosas: proponer «para Comunión» en general y proponer «para el domingo 20».
 * Son propuestas distintas —la base las guarda en dos filas y las cuenta en dos
 * rankings—, así que la pantalla tiene que dejar decir cuál de las dos es.
 */
export default function Sugerir({
  cantoId,
  momentos,
  misasProximas,
  mias,
}: {
  cantoId: string
  momentos: { id: string; nombre: string }[]
  /** Las que todavía no ocurrieron; una lista sin fecha también sirve. */
  misasProximas: { id: string; nombre: string; fecha: string | null }[]
  mias: Sugerencia[]
}) {
  const router = useRouter()
  const [momentoId, setMomentoId] = useState(momentos[0]?.id ?? '')
  const [misaId, setMisaId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()

  // Un canto sin momento asignado no se puede proponer: la propuesta ES para un
  // momento. Se calla en vez de mostrar un control que no puede funcionar.
  if (momentos.length === 0) return null

  const alcance = misaId === '' ? null : misaId
  const puesta = yaSugirio(mias, cantoId, momentoId, alcance)

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

  const payload = { cantoId, momentoId, misaId: alcance }

  return (
    <section className="mt-4 rounded-lg border border-borde px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="text-texto-tenue">Proponerlo para</span>

        {momentos.length === 1 ? (
          <span className="text-texto">{momentos[0]!.nombre}</span>
        ) : (
          <select
            value={momentoId}
            onChange={(e) => setMomentoId(e.target.value)}
            aria-label="Para qué momento lo propones"
            className="tactil rounded-lg border border-borde-fuerte bg-superficie px-2 text-sm"
          >
            {momentos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        )}

        {misasProximas.length > 0 && (
          <select
            value={misaId}
            onChange={(e) => setMisaId(e.target.value)}
            aria-label="Para cuándo lo propones"
            className="tactil rounded-lg border border-borde-fuerte bg-superficie px-2 text-sm"
          >
            <option value="">en general</option>
            {misasProximas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          disabled={pendiente}
          onClick={() =>
            correr(() => (puesta ? retirarSugerencia(payload) : sugerirCanto(payload)))
          }
          className={`tactil ml-auto rounded-lg px-3 text-sm disabled:opacity-40 ${
            puesta
              ? 'text-texto-tenue'
              : 'border border-acento text-acento'
          }`}
        >
          {puesta ? 'Retirar' : 'Proponer'}
        </button>
      </div>

      {/* Se dice lo que ya está propuesto con OTRO alcance, porque es la
          confusión inevitable de haber pedido las dos cosas: alguien la propone
          en general, cambia el selector a una misa y el botón vuelve a decir
          «Proponer» como si no hubiera hecho nada. */}
      {!puesta && yaSugirio(mias, cantoId, momentoId, null) && alcance !== null && (
        <p className="mt-1.5 text-xs text-texto-tenue">Ya lo propusiste en general.</p>
      )}

      {error && (
        <p role="alert" className="mt-1.5 text-xs text-peligro">
          {error}
        </p>
      )}
    </section>
  )
}
