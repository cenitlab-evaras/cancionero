'use client'

import { guardarVerPartitura, useVerPartitura } from './ver-partitura'

/**
 * «Ocultar / Mostrar partitura», en el renglón de las pestañas: ahí sobra
 * espacio, y un renglón propio (más un aviso) dejaba un hueco grande sobre la
 * barra cuando la partitura estaba oculta (el dueño, 2026-10-17).
 */
export default function InterruptorPartitura() {
  const ver = useVerPartitura()
  return (
    <button
      type="button"
      aria-pressed={!ver}
      aria-controls="partitura"
      onClick={() => guardarVerPartitura(!ver)}
      className="tactil -mb-px ml-auto flex items-center rounded-lg px-3 text-sm text-texto-tenue underline-offset-2 hover:text-texto hover:underline"
    >
      {ver ? 'Ocultar partitura' : 'Mostrar partitura'}
    </button>
  )
}
