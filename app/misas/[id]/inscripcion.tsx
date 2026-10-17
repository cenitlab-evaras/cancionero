'use client'

import { useOptimistic, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { guardarMiInscripcion, retirarMiInscripcion } from '../acciones'
import { INSTRUMENTOS_DEL_CORO, nombreInstrumento, type Aporte } from '@/lib/motores/inscripcion'
import { IconoListo } from '@/app/componentes/iconos'

type Mia = { aporte: Aporte; instrumento: string | null } | null

/**
 * «Voy» — la declaración de una persona sobre una misa (H15).
 *
 * Va PRIMERO, antes de la lista de quién va: lo que uno viene a hacer acá es
 * anotarse, y leer quién más se anotó es la consecuencia, no el objetivo.
 *
 * Rediseño del 2026-10-17 (el dueño: «se ve horrible de pesado con los botones
 * a la antigua»). Antes eran tres cajas —«A cantar», «A tocar» con borde y un
 * «Anotarme» en el halo— y dos pasos para algo que es un toque. Ahora es UN
 * control segmentado: tocar «A cantar» o «A tocar» ya te anota. Lo elegido se
 * llena con el halo y lleva un ✓, que es la confirmación. Se pinta al instante
 * (`useOptimistic`) y, si la base lo rechaza, vuelve atrás con el mensaje.
 *
 * El instrumento aparece solo con «A tocar», como fichas que también guardan
 * al tocarlas. Es la condicionalidad de B2 dibujada: dos campos siempre
 * visibles obligarían a mirar uno que no aplica, y dejarían la puerta abierta
 * a mandar los dos, que es justo lo que el `check` de la base rechaza.
 */
export default function Inscripcion({
  misaId,
  mia,
  editable,
}: {
  misaId: string
  mia: Mia
  /** Falso en una misa que ya ocurrió: se lee, no se cambia. */
  editable: boolean
}) {
  const router = useRouter()
  const [actual, ponerActual] = useOptimistic<Mia, Mia>(mia, (_, nueva) => nueva)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()

  function guardar(nueva: Mia) {
    setError(null)
    empezar(async () => {
      ponerActual(nueva)
      const r = nueva
        ? await guardarMiInscripcion(misaId, nueva)
        : await retirarMiInscripcion(misaId)
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

  const opciones: { aporte: Aporte; texto: string }[] = [
    { aporte: 'vocal', texto: 'A cantar' },
    { aporte: 'instrumental', texto: 'A tocar' },
  ]

  return (
    <div className="mt-3" aria-busy={pendiente}>
      <div
        role="group"
        aria-label="Voy a esta misa"
        className="grid grid-cols-2 gap-1 rounded-full border border-borde bg-superficie p-1"
      >
        {opciones.map((o) => {
          const elegida = actual?.aporte === o.aporte
          return (
            <button
              key={o.aporte}
              type="button"
              aria-pressed={elegida}
              onClick={() => {
                if (elegida) return
                guardar({
                  aporte: o.aporte,
                  instrumento:
                    o.aporte === 'instrumental' ? (actual?.instrumento ?? 'guitarra') : null,
                })
              }}
              className={`tactil inline-flex items-center justify-center gap-1.5 rounded-full px-4 text-[0.9375rem] ${
                elegida
                  ? 'bg-acento font-semibold text-sobre-acento'
                  : 'text-texto hover:bg-superficie-alta active:bg-borde'
              }`}
            >
              {elegida && <IconoListo tamano={18} />}
              {o.texto}
            </button>
          )
        })}
      </div>

      {actual?.aporte === 'instrumental' && (
        <div
          role="group"
          aria-label="Qué instrumento vas a tocar"
          className="mt-3 flex flex-wrap gap-2"
        >
          {INSTRUMENTOS_DEL_CORO.map((i) => {
            const elegido = actual.instrumento === i
            return (
              <button
                key={i}
                type="button"
                aria-pressed={elegido}
                onClick={() => !elegido && guardar({ aporte: 'instrumental', instrumento: i })}
                className={`tactil inline-flex items-center rounded-full border px-3.5 text-sm ${
                  elegido
                    ? 'border-texto bg-superficie-alta font-semibold text-texto'
                    : 'border-borde text-texto-tenue hover:border-borde-fuerte hover:text-texto'
                }`}
              >
                {nombreInstrumento(i)}
              </button>
            )
          })}
        </div>
      )}

      {/* Lo que pasó, en una línea. Retirarse no es destructivo —nadie pierde
          nada— así que va en texto, sin el color de peligro ni confirmación:
          se vuelve a anotar en un toque. */}
      {actual && (
        <div className="mt-2 flex min-h-11 items-center gap-1 text-sm text-texto-tenue">
          <span>
            {actual.aporte === 'vocal'
              ? 'Te anotaste a cantar.'
              : `Te anotaste con ${nombreInstrumento(actual.instrumento).toLowerCase()}.`}
          </span>
          <button
            type="button"
            onClick={() => guardar(null)}
            className="tactil -my-2 rounded-lg px-2 text-texto underline underline-offset-2 hover:text-acento"
          >
            No voy
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-peligro">
          {error}
        </p>
      )}
    </div>
  )
}
