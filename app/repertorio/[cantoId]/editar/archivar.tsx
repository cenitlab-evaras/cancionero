'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { archivarCanto } from '../../acciones'

/**
 * Sacar un canto de circulación (§16, cerrado el 2026-09-03).
 *
 * NO es un borrado y la pantalla lo dice, no lo insinúa: el canto sale del
 * repertorio y de la búsqueda, pero sigue en las misas donde ya se cantó y en
 * el historial. Por eso tampoco usa el color de peligro (§11.1) — pintarlo de
 * rojo prometería una destrucción que no ocurre.
 *
 * La confirmación es de dos pasos y **dice en cuántas misas aparece**. Un
 * «¿seguro?» pelado no informa nada: el número es justamente lo que hace que el
 * director decida distinto ante un canto que se cantó cuatro veces y uno que
 * cargó por error el martes.
 */
export default function Archivar({
  cantoId,
  enMisas,
}: {
  cantoId: string
  /** En cuántas misas aparece. Se calcula al leer, nunca se guarda. */
  enMisas: number
}) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()

  function archivar() {
    setError(null)
    empezar(async () => {
      const r = await archivarCanto(cantoId)
      if (!r.ok) {
        setError(r.error)
        return
      }
      router.push('/repertorio')
      router.refresh()
    })
  }

  return (
    <section className="mt-10 border-t border-borde pt-6 pb-10">
      <h2 className="text-[0.8125rem] font-semibold text-texto-tenue uppercase">
        Sacar del repertorio
      </h2>

      {!confirmando ? (
        <>
          <p className="mt-2 max-w-prose text-sm text-texto-tenue">
            Archivarlo lo saca del listado y de la búsqueda. No lo borra: sigue en las misas donde
            ya se cantó y en el historial, y puedes traerlo de vuelta cuando quieras.
          </p>
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className="tactil mt-3 rounded-lg border border-borde-fuerte px-3 text-sm"
          >
            Archivar este canto
          </button>
        </>
      ) : (
        <div className="mt-2">
          <p className="max-w-prose text-sm">
            {enMisas === 0
              ? 'Este canto no está en ninguna misa.'
              : enMisas === 1
                ? 'Este canto está en 1 misa. Va a seguir apareciendo ahí y en el historial.'
                : `Este canto está en ${enMisas} misas. Va a seguir apareciendo ahí y en el historial.`}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={archivar}
              disabled={pendiente}
              className="tactil rounded-lg bg-acento px-3 text-sm font-medium text-white disabled:opacity-40"
            >
              {pendiente ? 'Archivando…' : 'Sí, archivar'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              disabled={pendiente}
              className="tactil rounded-lg px-3 text-sm text-texto-tenue"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-peligro">
          {error}
        </p>
      )}
    </section>
  )
}
