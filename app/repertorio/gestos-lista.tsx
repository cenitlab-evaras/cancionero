'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ANCHO_ACCION, ANCHO_ARCHIVAR } from './gestos-constantes'
import { archivarCanto, enviarAProximaMisa, marcarParaEnsayar } from './acciones'

/**
 * Los gestos de las filas del repertorio, por DELEGACIÓN (2026-11-20).
 *
 * Antes cada fila era una isla de cliente con su estado y sus punteros: 529
 * componentes por pantalla y una hidratación carísima en el teléfono. Ahora el
 * servidor pinta la fila con sus botones detrás y este único componente
 * escucha el contenedor: decide el eje, mueve el frente de UNA fila, y ejecuta
 * la acción del botón tocado.
 *
 * El gesto es el mismo de siempre: a la izquierda descubre «Próxima misa» y
 * «Ensayar»; a la derecha, «Archivar». Dos pasos: el gesto descubre, tocar
 * confirma. La barra de estado avisa el resultado.
 */
const DECIDIR_PX = 8
const TRANSICION = 'transform var(--transicion)'

type Estado = {
  frente: HTMLElement
  x: number
  y: number
  lado: boolean | null
  desdeX: number
}

type Respuesta = { ok: true; mensaje?: string } | { ok: false; error: string }

const ACCIONES: Record<string, (cantoId: string) => Promise<Respuesta>> = {
  proxima: enviarAProximaMisa,
  ensayo: marcarParaEnsayar,
  archivar: archivarCanto,
}

export default function GestosDeLista({ children }: { children: ReactNode }) {
  const router = useRouter()
  const contenedor = useRef<HTMLDivElement>(null)
  const gesto = useRef<Estado | null>(null)
  const abierta = useRef<HTMLElement | null>(null)
  const tragado = useRef(false)
  const ocupado = useRef(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current)
  }, [])

  function botonesDe(frente: HTMLElement): HTMLButtonElement[] {
    const fila = frente.closest<HTMLElement>('[data-fila-canto]')
    return [...(fila?.querySelectorAll<HTMLButtonElement>('[data-accion]') ?? [])]
  }

  function habilitarBotones(frente: HTMLElement, visible: boolean, lado?: 'izquierda' | 'derecha') {
    for (const boton of botonesDe(frente)) {
      const esArchivar = boton.dataset.accion === 'archivar'
      const corresponde =
        visible && (lado === undefined || (lado === 'derecha') === esArchivar)
      boton.tabIndex = corresponde ? 0 : -1
      boton.setAttribute('aria-hidden', corresponde ? 'false' : 'true')
    }
  }

  function mover(frente: HTMLElement, desplazo: number) {
    frente.style.transform = desplazo === 0 ? '' : `translateX(${desplazo}px)`
  }

  function cerrarTodas(excepto?: HTMLElement) {
    for (const frente of contenedor.current?.querySelectorAll<HTMLElement>('[data-frente]') ?? []) {
      if (frente === excepto) continue
      frente.style.transition = TRANSICION
      mover(frente, 0)
      habilitarBotones(frente, false)
    }
    if (abierta.current && abierta.current !== excepto) abierta.current = null
  }

  function avisar(tipo: 'ok' | 'error', texto: string) {
    setAviso({ tipo, texto })
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => setAviso(null), 5000)
  }

  async function correrAccion(boton: HTMLButtonElement) {
    const accion = boton.dataset.accion
    const cantoId = boton.dataset.canto
    const fn = accion ? ACCIONES[accion] : undefined
    if (!fn || !cantoId || ocupado.current) return
    ocupado.current = true
    const frente = boton.closest<HTMLElement>('[data-fila-canto]')?.querySelector<HTMLElement>('[data-frente]')
    try {
      const r = await fn(cantoId)
      if (!r.ok) {
        avisar('error', r.error)
        return
      }
      avisar('ok', r.mensaje ?? 'Hecho')
      if (frente) {
        mover(frente, 0)
        habilitarBotones(frente, false)
        abierta.current = null
      }
      router.refresh()
    } finally {
      ocupado.current = false
    }
  }

  return (
    <div
      ref={contenedor}
      onPointerDown={(e) => {
        if (e.button !== 0 || ocupado.current) return
        const objetivo = e.target as HTMLElement
        // Los controles de la fila (casilla, enlaces de marcas) no inician gesto.
        if (objetivo.closest('[data-accion], [role=checkbox]')) return
        const frente = objetivo.closest<HTMLElement>('[data-frente]')
        if (!frente) return
        tragado.current = false
        const matriz = getComputedStyle(frente).transform
        const actual = matriz && matriz !== 'none' ? new DOMMatrixReadOnly(matriz).m41 : 0
        gesto.current = { frente, x: e.clientX, y: e.clientY, lado: null, desdeX: actual }
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
          g.frente.setPointerCapture(e.pointerId)
          g.frente.style.transition = 'none'
          cerrarTodas(g.frente)
        }
        tragado.current = true
        const anchoIzquierda = botonesDe(g.frente).filter((b) => b.dataset.accion !== 'archivar').length * ANCHO_ACCION
        const crudo = g.desdeX + dx
        if (crudo < -anchoIzquierda) {
          mover(g.frente, -anchoIzquierda + (crudo + anchoIzquierda) / 3)
        } else if (crudo > ANCHO_ARCHIVAR) {
          mover(g.frente, ANCHO_ARCHIVAR + (crudo - ANCHO_ARCHIVAR) / 3)
        } else {
          mover(g.frente, crudo)
        }
      }}
      onPointerUp={() => {
        const g = gesto.current
        gesto.current = null
        if (!g?.lado) return
        g.frente.style.transition = TRANSICION
        const anchoIzquierda = botonesDe(g.frente).filter((b) => b.dataset.accion !== 'archivar').length * ANCHO_ACCION
        const matriz = getComputedStyle(g.frente).transform
        const actual = matriz && matriz !== 'none' ? new DOMMatrixReadOnly(matriz).m41 : 0
        if (actual <= -anchoIzquierda / 2 && anchoIzquierda > 0) {
          mover(g.frente, -anchoIzquierda)
          habilitarBotones(g.frente, true, 'izquierda')
          abierta.current = g.frente
        } else if (actual >= ANCHO_ARCHIVAR / 2 && botonesDe(g.frente).some((b) => b.dataset.accion === 'archivar')) {
          mover(g.frente, ANCHO_ARCHIVAR)
          habilitarBotones(g.frente, true, 'derecha')
          abierta.current = g.frente
        } else {
          mover(g.frente, 0)
          habilitarBotones(g.frente, false)
          abierta.current = null
        }
      }}
      onPointerCancel={() => {
        const g = gesto.current
        gesto.current = null
        if (!g) return
        g.frente.style.transition = TRANSICION
        mover(g.frente, 0)
        habilitarBotones(g.frente, false)
        abierta.current = null
      }}
      onClickCapture={(e) => {
        const objetivo = e.target as HTMLElement
        if (tragado.current) {
          tragado.current = false
          e.preventDefault()
          e.stopPropagation()
          return
        }
        const boton = objetivo.closest<HTMLButtonElement>('[data-accion]')
        if (boton) {
          e.preventDefault()
          e.stopPropagation()
          void correrAccion(boton)
          return
        }
        // Con una fila abierta, tocar el frente la cierra sin navegar.
        if (abierta.current) {
          e.preventDefault()
          e.stopPropagation()
          mover(abierta.current, 0)
          habilitarBotones(abierta.current, false)
          abierta.current = null
        }
      }}
      onDragStart={(e) => e.preventDefault()}
    >
      {children}

      {aviso && (
        <p
          role="status"
          className={`fixed inset-x-4 bottom-[calc(var(--alto-barra-nav)+8px)] z-(--z-cabecera) mx-auto max-w-2xl rounded-xl border bg-superficie px-3 py-2 text-sm shadow-lg ${
            aviso.tipo === 'error' ? 'border-peligro text-peligro' : 'border-acento text-texto'
          }`}
        >
          {aviso.texto}
        </p>
      )}
    </div>
  )
}
