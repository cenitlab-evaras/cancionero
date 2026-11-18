'use client'

import { useSyncExternalStore } from 'react'

const LLAVE = 'cantoral_aviso_deslizar_visto'
const oyentes = new Set<() => void>()

/** Si esta persona ya cerró la pista, leído del navegador. */
function leerVisto(): boolean {
  try {
    return localStorage.getItem(LLAVE) === '1'
  } catch {
    return false
  }
}

function suscribir(aviso: () => void) {
  oyentes.add(aviso)
  return () => {
    oyentes.delete(aviso)
  }
}

function cerrar() {
  try {
    localStorage.setItem(LLAVE, '1')
  } catch {
    // Sin almacenamiento la pista vuelve la próxima vez, sin romper nada.
  }
  for (const aviso of oyentes) aviso()
}

/**
 * La pista del gesto de archivar, una sola vez por persona (2026-11-17).
 *
 * Es una conveniencia de este navegador, no estado del producto: por eso vive
 * en `localStorage` y no en la base. Se lee con `useSyncExternalStore` —el
 * patrón del repo para el navegador— porque el servidor pinta la pista y el
 * cliente decide con lo guardado al hidratar, sin desajustar el HTML.
 */
export default function AvisoDeslizar() {
  const visto = useSyncExternalStore(suscribir, leerVisto, () => false)
  if (visto) return null

  return (
    <p className="mt-3 flex items-baseline gap-3 text-sm text-texto-tenue">
      <span>Desliza un canto a la izquierda para archivarlo.</span>
      <button
        type="button"
        onClick={cerrar}
        className="underline underline-offset-2 hover:text-texto"
      >
        Entendido
      </button>
    </p>
  )
}
