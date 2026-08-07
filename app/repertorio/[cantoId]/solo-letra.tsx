'use client'

import { useRouter } from 'next/navigation'
import { useOptimistic, useTransition } from 'react'
import { guardarMostrarAcordes } from './acciones'

/**
 * El interruptor de acordes (H11).
 *
 * Vive en la cabecera del canto, no en la barra inferior: esa barra es para lo
 * que se toca MIENTRAS se canta —transponer, velocidad, tamaño— y ya declaraba
 * que en 360 px no entraba un control más. Esto se elige una vez.
 *
 * Y lo que guarda vale para TODO el repertorio, no para este canto: quien canta
 * sin instrumento no quiere apagarlos canto por canto. Por eso el texto dice
 * "acordes" a secas y no "acordes de este canto".
 */
export default function SoloLetra({ mostrarAcordes }: { mostrarAcordes: boolean }) {
  const router = useRouter()
  const [, iniciarTransicion] = useTransition()
  const [optimista, aplicarOptimista] = useOptimistic(mostrarAcordes)

  function alternar() {
    iniciarTransicion(async () => {
      aplicarOptimista(!optimista)
      await guardarMostrarAcordes(!optimista)
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={optimista}
      // El nombre dice el ESTADO, no la acción: un lector de pantalla anuncia
      // "Ver acordes, activado", que es la forma en que se lee un interruptor.
      aria-label="Ver acordes"
      title={optimista ? 'Ocultar los acordes en todo el repertorio' : 'Volver a ver los acordes'}
      className={`shrink-0 rounded px-1 text-xs transition-colors ${
        optimista
          ? 'text-acorde hover:text-texto'
          : 'text-texto-tenue line-through decoration-1 hover:text-texto'
      }`}
    >
      acordes
    </button>
  )
}
