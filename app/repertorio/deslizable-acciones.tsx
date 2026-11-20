'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition, type ReactNode } from 'react'

/**
 * La fila con gestos, como el correo del teléfono (el dueño, 2026-11-20):
 * deslizar a la IZQUIERDA descubre «Próxima misa» y «Ensayar»; a la DERECHA,
 * «Archivar». Dos pasos: el gesto descubre los botones y tocar uno confirma.
 * Un dedo que resbala bajando por la lista no hace nada.
 *
 * El eje se decide en los primeros 8 px: si el dedo va más de lado que hacia
 * abajo, es gesto; si no, es el scroll de siempre (`touch-action: pan-y`).
 * Después de arrastrar, el clic que dispara el navegador al soltar se traga,
 * para no abrir el canto sin querer.
 *
 * Es un atajo: las tres acciones siguen existiendo en «Editar canto» y en el
 * armador de la misa, que es el camino con teclado y lector de pantalla.
 */
const ANCHO = 106
const DERECHA = 96
const DECIDIR_PX = 8

export type AccionDeFila = {
  texto: string
  peligro?: boolean
  alConfirmar: () => Promise<{ ok: true; mensaje?: string } | { ok: false; error: string }>
}

export default function DeslizableAcciones({
  izquierda,
  derecha,
  children,
  className = '',
}: {
  /** Se descubren deslizando a la izquierda; se dibujan a la derecha. */
  izquierda: AccionDeFila[]
  /** Se descubre deslizando a la derecha; se dibuja a la izquierda. */
  derecha?: AccionDeFila
  children: ReactNode
  /** Clases del frente (la fila que se desliza). */
  className?: string
}) {
  const router = useRouter()
  const [desplazo, setDesplazo] = useState(0)
  const [arrastrando, setArrastrando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const [enCurso, iniciar] = useTransition()
  const gesto = useRef<{ x: number; y: number; desde: number; lado: boolean | null } | null>(null)
  const tragarClic = useRef(false)

  const anchoIzquierda = ANCHO * izquierda.length
  const abiertaIzquierda = desplazo <= -anchoIzquierda / 2
  const abiertaDerecha = desplazo >= DERECHA / 2

  function correr(accion: AccionDeFila) {
    setAviso(null)
    iniciar(async () => {
      const r = await accion.alConfirmar()
      if (!r.ok) {
        setAviso({ tipo: 'error', texto: r.error })
        return
      }
      setDesplazo(0)
      setAviso({ tipo: 'ok', texto: ('mensaje' in r && r.mensaje) || 'Hecho' })
      router.refresh()
    })
  }

  return (
    <div>
      {/* El recorte cubre SOLO la fila: si el aviso quedara adentro, los
          botones absolutos se estirarían detrás de él (se veían al costado). */}
      <div className="relative overflow-hidden">
        {/* A la izquierda del todo: la acción de deslizar a la derecha. */}
        {derecha && (
          <button
            type="button"
            onClick={() => correr(derecha)}
            disabled={enCurso}
            tabIndex={abiertaDerecha ? 0 : -1}
            aria-hidden={!abiertaDerecha}
            style={{ width: DERECHA }}
            className="absolute inset-y-0 left-0 flex items-center justify-center bg-peligro px-2 text-sm font-bold text-sobre-peligro disabled:opacity-70"
          >
            {enCurso ? '…' : derecha.texto}
          </button>
        )}

        {/* A la derecha: las acciones de deslizar a la izquierda. */}
        <div
          className="absolute inset-y-0 right-0 flex"
          style={{ width: anchoIzquierda }}
          aria-hidden={!abiertaIzquierda}
        >
          {izquierda.map((accion) => (
            <button
              key={accion.texto}
              type="button"
              onClick={() => correr(accion)}
              disabled={enCurso}
              tabIndex={abiertaIzquierda ? 0 : -1}
              style={{ width: ANCHO }}
              className={`flex items-center justify-center px-2 text-sm font-bold disabled:opacity-70 ${
                accion.peligro
                  ? 'bg-peligro text-sobre-peligro'
                  : 'bg-superficie-alta text-texto'
              }`}
            >
              {enCurso ? '…' : accion.texto}
            </button>
          ))}
        </div>

        <div
          className={`relative bg-fondo ${className}`}
          style={{
            transform: `translateX(${desplazo}px)`,
            transition: arrastrando ? 'none' : 'transform var(--transicion)',
            touchAction: 'pan-y',
          }}
          onPointerDown={(e) => {
            if (e.button !== 0 || enCurso) return
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
            const crudo = g.desde + dx
            if (crudo < -anchoIzquierda) {
              setDesplazo(-anchoIzquierda + (crudo + anchoIzquierda) / 3)
            } else if (crudo > DERECHA) {
              setDesplazo(DERECHA + (crudo - DERECHA) / 3)
            } else {
              setDesplazo(crudo)
            }
          }}
          onPointerUp={() => {
            const g = gesto.current
            gesto.current = null
            if (!g?.lado) return
            setArrastrando(false)
            setDesplazo((d) =>
              d <= -anchoIzquierda / 2 ? -anchoIzquierda : d >= DERECHA / 2 ? DERECHA : 0
            )
          }}
          onPointerCancel={() => {
            gesto.current = null
            setArrastrando(false)
            setDesplazo((d) =>
              d <= -anchoIzquierda / 2 ? -anchoIzquierda : d >= DERECHA / 2 ? DERECHA : 0
            )
          }}
          onClickCapture={(e) => {
            if (tragarClic.current) {
              e.preventDefault()
              e.stopPropagation()
              tragarClic.current = false
              return
            }
            if (desplazo !== 0) {
              e.preventDefault()
              e.stopPropagation()
              setDesplazo(0)
            }
          }}
          onDragStart={(e) => e.preventDefault()}
        >
          {children}
        </div>
      </div>

      {aviso && (
        <p
          role="status"
          className={`bg-fondo px-2 pb-2 text-sm ${aviso.tipo === 'error' ? 'text-peligro' : 'text-acento'}`}
        >
          {aviso.texto}
        </p>
      )}
    </div>
  )
}
