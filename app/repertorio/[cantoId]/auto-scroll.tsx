'use client'

import { useEffect, useRef, useState } from 'react'
import {
  VELOCIDAD_MAX,
  VELOCIDAD_MIN,
  VELOCIDAD_POR_DEFECTO,
  avanzar,
  pixelesPorSegundo,
} from '@/lib/motores/autoscroll'

/**
 * Auto scroll (H4, RF-21): la pantalla baja sola mientras se toca.
 *
 * Toda la aritmética vive en el motor y está probada; acá solo queda el pegamento
 * con el navegador: pedir cuadros, mover la ventana y parar al llegar al final.
 *
 * La velocidad NO se persiste: cambia con la canción, con el tempo del día y con
 * quién toca. El PRD solo pide recordar transposición y tamaño (§7), y no se
 * adelanta una columna que nadie pidió.
 */
export default function AutoScroll() {
  const [andando, setAndando] = useState(false)
  const [velocidad, setVelocidad] = useState(VELOCIDAD_POR_DEFECTO)

  // En refs y no en estado: cambian en cada cuadro y no deben repintar nada.
  const resto = useRef(0)
  const ultimoCuadro = useRef<number | null>(null)
  const velocidadRef = useRef(velocidad)
  velocidadRef.current = velocidad

  useEffect(() => {
    if (!andando) {
      // Pausa: se olvida el instante del último cuadro para que al reanudar no
      // se compute el tiempo que estuvo detenido. Así "sigue desde ahí".
      ultimoCuadro.current = null
      resto.current = 0
      return
    }

    let pedido = 0

    function cuadro(ahora: number) {
      if (ultimoCuadro.current !== null) {
        const paso = avanzar(
          resto.current,
          pixelesPorSegundo(velocidadRef.current),
          ahora - ultimoCuadro.current
        )
        resto.current = paso.resto

        if (paso.avance > 0) {
          const antes = window.scrollY
          window.scrollBy(0, paso.avance)
          // Si la ventana no se movió, se llegó al final: detenerse solo en vez
          // de seguir pidiendo cuadros para siempre.
          if (window.scrollY === antes) {
            setAndando(false)
            return
          }
        }
      }
      ultimoCuadro.current = ahora
      pedido = requestAnimationFrame(cuadro)
    }

    pedido = requestAnimationFrame(cuadro)
    return () => cancelAnimationFrame(pedido)
  }, [andando])

  return (
    <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
      <button
        onClick={() => setAndando((v) => !v)}
        aria-label={andando ? 'Pausar el desplazamiento' : 'Desplazar solo'}
        aria-pressed={andando}
        className={`tactil flex w-11 shrink-0 items-center justify-center rounded-lg border text-sm ${
          andando
            ? 'border-acento bg-acento/15 text-acento'
            : 'border-borde-fuerte bg-superficie text-texto hover:bg-superficie-alta'
        }`}
      >
        {/* Íconos dibujados, no tipográficos: los glifos de reproducción varían
            entre sistemas y se ven de tamaños distintos. */}
        {andando ? (
          <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden fill="currentColor">
            <rect x="0" y="0" width="4" height="14" rx="1" />
            <rect x="8" y="0" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="12" height="14" viewBox="0 0 12 14" aria-hidden fill="currentColor">
            <path d="M0 1.2v11.6a1 1 0 0 0 1.5.87l9.5-5.8a1 1 0 0 0 0-1.74L1.5.33A1 1 0 0 0 0 1.2Z" />
          </svg>
        )}
      </button>

      <input
        type="range"
        min={VELOCIDAD_MIN}
        max={VELOCIDAD_MAX}
        step={1}
        value={velocidad}
        onChange={(e) => setVelocidad(Number(e.target.value))}
        className="h-11 w-full min-w-10 accent-acento"
        aria-label={`Velocidad del desplazamiento, nivel ${velocidad} de ${VELOCIDAD_MAX}`}
      />
    </div>
  )
}
