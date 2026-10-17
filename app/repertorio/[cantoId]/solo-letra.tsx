'use client'

import { useRouter } from 'next/navigation'
import { useOptimistic, useTransition } from 'react'
import { guardarMostrarAcordes } from './acciones'
import { clasesBotonIcono } from '@/app/componentes/boton-icono'
import { IconoAcordes } from '@/app/componentes/iconos'

/**
 * El interruptor de acordes (H11).
 *
 * Vive en la cabecera del canto, no en la barra inferior: esa barra es para lo
 * que se toca MIENTRAS se canta. Esto se elige una vez, y lo que guarda vale
 * para TODO el repertorio, no para este canto.
 *
 * Rediseño 2026-10-17: era una píldora de 60×23 px con la palabra «acordes»
 * que no decía qué hacía. Ahora es un control de 44 px con su ícono y su texto,
 * y el estado se dice con superficie y con una barra que tacha el ícono —
 * nunca con el color del acorde, que es solo para los acordes.
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
      className={clasesBotonIcono(optimista ? 'activo' : 'plano')}
    >
      <span className="relative">
        <IconoAcordes />
        {!optimista && (
          <span
            aria-hidden
            className="absolute top-1/2 left-1/2 h-[1.75px] w-7 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded bg-current"
          />
        )}
      </span>
    </button>
  )
}
