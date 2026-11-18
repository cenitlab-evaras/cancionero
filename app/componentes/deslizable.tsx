'use client'

import { useRef, useState, useTransition, type ReactNode } from 'react'

/**
 * Deslizar a la izquierda para una acción, como en el correo del teléfono (el
 * dueño, 2026-10-17: «usemos el swipe con el dedo»). Lo usa el director para
 * quitar un canto de la misa y para archivar uno del repertorio.
 *
 * Dos pasos a propósito: deslizar DESCUBRE el botón rojo y tocarlo confirma.
 * Un dedo que resbala al bajar por la lista no se lleva nada. Tocar la fila
 * abierta, o deslizarla de vuelta, la cierra sin hacer nada.
 *
 * El gesto se decide en los primeros píxeles: si el dedo va más de lado que
 * hacia abajo es deslizar; si no, es el scroll de siempre (`touch-action:
 * pan-y` deja el vertical al navegador). Después de deslizar, el clic que
 * llega al soltar no abre el enlace de debajo.
 *
 * Es un atajo: cada acción sigue teniendo su botón en otra pantalla («Armar
 * la misa», «Editar»), que es el camino con teclado y lector de pantalla.
 */
const ANCHO = 112
const DECIDIR_PX = 8

export type ResultadoAccion = { ok: true } | { ok: false; error: string }

export default function Deslizable({
  texto,
  alConfirmar,
  alTerminar,
  children,
  className = '',
}: {
  /** Lo que dice el botón rojo: «Quitar», «Archivar». */
  texto: string
  alConfirmar: () => Promise<ResultadoAccion>
  /** Después de un `ok`: refrescar, sacar la fila de una lista local… */
  alTerminar?: () => void
  children: ReactNode
  /** Clases del frente (la fila que se desliza). */
  className?: string
}) {
  const [desplazo, setDesplazo] = useState(0)
  const [arrastrando, setArrastrando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [enCurso, iniciar] = useTransition()
  const gesto = useRef<{ x: number; y: number; desde: number; lado: boolean | null } | null>(null)
  const tragarClic = useRef(false)
  const abierta = desplazo <= -ANCHO / 2

  function cerrar() {
    setDesplazo(0)
    setError(null)
  }

  function confirmar() {
    setError(null)
    iniciar(async () => {
      const r = await alConfirmar()
      if (!r.ok) {
        setError(r.error)
        return
      }
      setDesplazo(0)
      alTerminar?.()
    })
  }

  return (
    <div className="relative overflow-hidden">
      {/* El botón queda detrás de la fila; deslizarla lo descubre. */}
      <button
        type="button"
        onClick={confirmar}
        disabled={enCurso}
        tabIndex={abierta ? 0 : -1}
        aria-hidden={!abierta}
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-peligro px-3 font-bold text-sobre-peligro disabled:opacity-70"
        style={{ width: ANCHO }}
      >
        {enCurso ? '…' : texto}
      </button>

      <div
        className={`relative bg-fondo ${className}`}
        style={{
          transform: `translateX(${desplazo}px)`,
          transition: arrastrando ? 'none' : 'transform var(--transicion)',
          touchAction: 'pan-y',
        }}
        onPointerDown={(e) => {
          if (e.button !== 0 || enCurso) return
          // Dentro de la fila hay controles con su propio gesto (el asa ⋮⋮ que
          // arrastra el canto). Si el dedo baja ahí, este deslizado no existe:
          // capturar el puntero le quitaría los movimientos al arrastre.
          if ((e.target as HTMLElement).closest?.('[data-sin-deslizar]')) return
          tragarClic.current = false
          gesto.current = { x: e.clientX, y: e.clientY, desde: desplazo, lado: null }
        }}
        onPointerMove={(e) => {
          const g = gesto.current
          if (!g) return
          const dx = e.clientX - g.x
          const dy = e.clientY - g.y
          if (g.lado === null) {
            if (Math.abs(dx) < DECIDIR_PX && Math.abs(dy) < DECIDIR_PX) return
            g.lado = Math.abs(dx) > Math.abs(dy)
            if (!g.lado) {
              gesto.current = null
              return
            }
            e.currentTarget.setPointerCapture(e.pointerId)
            setArrastrando(true)
          }
          tragarClic.current = true
          // Hasta un poco más que el botón, con resistencia; nunca a la derecha.
          const crudo = Math.min(0, g.desde + dx)
          setDesplazo(crudo < -ANCHO ? -ANCHO + (crudo + ANCHO) / 3 : crudo)
        }}
        onPointerUp={() => {
          const g = gesto.current
          gesto.current = null
          if (!g?.lado) return
          setArrastrando(false)
          setDesplazo((d) => (d <= -ANCHO / 2 ? -ANCHO : 0))
        }}
        onPointerCancel={() => {
          gesto.current = null
          setArrastrando(false)
          setDesplazo((d) => (d <= -ANCHO / 2 ? -ANCHO : 0))
        }}
        onClickCapture={(e) => {
          // El clic que el navegador dispara al soltar un gesto no es un toque:
          // se traga sin navegar y sin cerrar lo que el gesto acaba de abrir.
          if (tragarClic.current) {
            e.preventDefault()
            e.stopPropagation()
            tragarClic.current = false
            return
          }
          // Tocar la fila abierta la cierra sin hacer nada.
          if (abierta) {
            e.preventDefault()
            e.stopPropagation()
            cerrar()
          }
        }}
        // Sin esto, arrastrar con el mouse sobre el enlace de la fila inicia el
        // drag nativo del navegador: llega `pointercancel` y el gesto muere.
        onDragStart={(e) => e.preventDefault()}
      >
        {children}
      </div>

      {error && (
        <p role="alert" className="bg-fondo px-2 pb-2 text-sm text-peligro">
          {error}
        </p>
      )}
    </div>
  )
}
