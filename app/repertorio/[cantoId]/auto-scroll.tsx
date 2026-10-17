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
 * Es un hook y no un componente desde el rediseño del 2026-10-17: la barra de
 * lectura necesita saber si está corriendo para cambiar lo que muestra (con el
 * desplazamiento andando, la velocidad ocupa el lugar de transponer).
 *
 * La velocidad NO se persiste: cambia con la canción, con el tempo del día y con
 * quién toca. El PRD solo pide recordar transposición y tamaño (§7).
 */
export function useAutoScroll() {
  const [andando, setAndando] = useState(false)
  const [velocidad, setVelocidad] = useState(VELOCIDAD_POR_DEFECTO)

  // En refs y no en estado: cambian en cada cuadro y no deben repintar nada.
  const resto = useRef(0)
  const ultimoCuadro = useRef<number | null>(null)
  const velocidadRef = useRef(velocidad)
  useEffect(() => {
    velocidadRef.current = velocidad
  }, [velocidad])

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

  return {
    andando,
    alternar: () => setAndando((v) => !v),
    velocidad,
    setVelocidad,
  }
}

/**
 * El deslizador de velocidad, con su valor a la vista.
 *
 * La perilla es en marfil y no en el halo: en la lectura lo único cálido es el
 * acorde (DESIGN.md). El alto de 44 px es la zona táctil, no el dibujo.
 */
export function Velocidad({
  velocidad,
  setVelocidad,
}: {
  velocidad: number
  setVelocidad: (v: number) => void
}) {
  return (
    <label className="flex min-w-0 flex-1 items-center gap-3">
      <span className="sr-only">Velocidad del desplazamiento</span>
      <input
        type="range"
        min={VELOCIDAD_MIN}
        max={VELOCIDAD_MAX}
        step={1}
        value={velocidad}
        onChange={(e) => setVelocidad(Number(e.target.value))}
        className="deslizador h-11 min-w-0 flex-1"
        aria-valuetext={`${velocidad} de ${VELOCIDAD_MAX}`}
      />
      <span className="w-5 shrink-0 text-right font-bold">{velocidad}</span>
    </label>
  )
}
