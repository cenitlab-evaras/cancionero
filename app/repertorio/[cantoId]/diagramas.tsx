'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react'
import { useRouter } from 'next/navigation'
import { BotonIcono } from '@/app/componentes/boton-icono'
import { IconoCerrar } from '@/app/componentes/iconos'
import { ANCHO_CARACTER } from '@/lib/motores/cifrado-ancho'
import { corregirAcorde } from './acciones'

/**
 * La parte de cliente de H5, y nada más que eso.
 *
 * Acá no se calcula ni un acorde ni una digitación: los diagramas llegan
 * pintados desde el servidor. Lo único que vive en el navegador es el gesto —
 * abrir, cerrar y traer a la vista la carta que se tocó.
 *
 * El foco se guarda por ÍNDICE, no por nombre. Al transponer, el servidor
 * re-renderiza y todos los nombres cambian (`E` → `F#`): un foco por nombre
 * quedaría huérfano y la barra se cerraría sola. El orden de la lista, en
 * cambio, es invariante —es orden de primera aparición y transponer es una
 * biyección—, así que el índice 4 sigue siendo el mismo acorde musical.
 */

type Estado = {
  acordes: string[]
  foco: number | null
  /**
   * H19-B · El ORDINAL del acorde que se tocó en el cifrado —cuál de los veinte
   * `[G]`—, no su lugar en la tira. Solo existe si la hoja se abrió tocando el
   * texto: es lo que «Corregir este acorde» corrige.
   */
  tocado: number | null
  abrirEn: (nombre: string, indice?: number) => void
  cerrar: () => void
}

const ContextoDiagramas = createContext<Estado | null>(null)

export function ProveedorDiagramas({
  acordes,
  children,
}: {
  acordes: string[]
  children: ReactNode
}) {
  const [foco, setFoco] = useState<number | null>(null)
  const [tocado, setTocado] = useState<number | null>(null)

  const abrirEn = useCallback(
    (nombre: string, indice?: number) => {
      const i = acordes.indexOf(nombre)
      if (i < 0) return
      // Volver a tocar el mismo acorde cierra: el gesto que abre es el que cierra.
      // «El mismo» es la misma aparición: tocar otro `[G]` mueve la corrección
      // a ese, sin cerrar la hoja.
      const cierra = foco === i && (indice === undefined || indice === tocado)
      setFoco(cierra ? null : i)
      setTocado(cierra ? null : (indice ?? null))
    },
    [acordes, foco, tocado]
  )

  const cerrar = useCallback(() => {
    setFoco(null)
    setTocado(null)
  }, [])

  const valor = useMemo(
    () => ({ acordes, foco, tocado, abrirEn, cerrar }),
    [acordes, foco, tocado, abrirEn, cerrar]
  )

  return <ContextoDiagramas.Provider value={valor}>{children}</ContextoDiagramas.Provider>
}

export function useDiagramas() {
  const ctx = useContext(ContextoDiagramas)
  if (!ctx) throw new Error('Falta <ProveedorDiagramas> más arriba en el árbol.')
  return ctx
}

/**
 * Envuelve el cifrado y escucha los toques por DELEGACIÓN.
 *
 * Un componente cliente por acorde sería caro sin necesidad: *Himno Misión
 * País* tiene 91 corchetes. Con un solo escuchador, los acordes siguen siendo
 * `<button>` de verdad, así que el teclado funciona sin una línea extra.
 */
/**
 * La zona del cifrado: abre los diagramas al TOCAR un acorde y, para el
 * director, deja ARRASTRARLO a otra columna de la letra (2026-11-17).
 *
 * El arrastre no inventa un gesto nuevo: el toque sigue abriendo la hoja. Si el
 * puntero se mueve más de 8 px en horizontal, el toque se convierte en
 * arrastre: el acorde se mueve pegado a la rejilla monoespaciada y una guía
 * marca la columna donde va a caer. Al soltar se guarda UNA vez, con la misma
 * action de «Corregir» (validación, vista sin cambios y versión en el historial).
 *
 * El camino accesible no cambia: tocar → «Corregir este acorde» → flechas.
 */
export function ZonaAcordes({
  children,
  arrastre,
}: {
  children: ReactNode
  /** Solo el director (`editar_canto`): la vista del cifrado y su tono. */
  arrastre?: { cantoId: string; vista: string; transposicion: number }
}) {
  const { abrirEn } = useDiagramas()
  const router = useRouter()
  const [, iniciar] = useTransition()
  const [error, setError] = useState<string | null>(null)
  /** Hasta cuándo ignorar el clic: soltar un arrastre no debe abrir la hoja. */
  const arrastroReciente = useRef(0)
  const gesto = useRef<{
    btn: HTMLButtonElement
    linea: HTMLElement
    indice: number
    col0: number
    min: number
    max: number
    x0: number
    y0: number
    activo: boolean
    destino: number
    charW: number
    guia: HTMLElement | null
    pointerId: number
  } | null>(null)

  function terminar() {
    const g = gesto.current
    if (!g) return null
    gesto.current = null
    g.guia?.remove()
    g.linea.style.position = ''
    g.btn.style.transform = ''
    g.btn.style.backgroundColor = ''
    g.btn.style.borderRadius = ''
    return g
  }

  return (
    <div
      className={arrastre ? 'con-arrastre' : ''}
      onPointerDown={(e) => {
        if (!arrastre || e.button !== 0) return
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-acorde]')
        const linea = btn?.closest<HTMLElement>('[data-linea-cifrado]')
        if (!btn || !linea) return
        const col0 = Number(btn.dataset.columna)
        if (!Number.isFinite(col0)) return
        // Los vecinos de la MISMA línea ponen los topes: un acorde no atraviesa
        // a otro; se queda en la columna de al lado.
        const cols = [...linea.querySelectorAll<HTMLButtonElement>('[data-acorde]')].map((b) =>
          Number(b.dataset.columna)
        )
        const izquierda = cols.filter((c) => c < col0)
        const derecha = cols.filter((c) => c > col0)
        const letra = linea.querySelector<HTMLElement>('[data-letra]')
        const min = (izquierda.length ? Math.max(...izquierda) : -1) + 1
        const max = Math.min(
          derecha.length ? Math.min(...derecha) - 1 : Number.POSITIVE_INFINITY,
          letra?.textContent?.length ?? col0
        )
        if (max < min) return
        const raiz = btn.closest<HTMLElement>('.cifrado')
        const charW =
          (Number.parseFloat(getComputedStyle(raiz ?? btn).fontSize) || 16) * ANCHO_CARACTER
        gesto.current = {
          btn,
          linea,
          indice: Number(btn.dataset.indice),
          col0,
          min,
          max,
          x0: e.clientX,
          y0: e.clientY,
          activo: false,
          destino: col0,
          charW,
          guia: null,
          pointerId: e.pointerId,
        }
        btn.setPointerCapture(e.pointerId)
      }}
      onPointerMove={(e) => {
        const g = gesto.current
        if (!g || e.pointerId !== g.pointerId) return
        const dx = e.clientX - g.x0
        const dy = e.clientY - g.y0
        if (!g.activo) {
          // Vertical gana el navegador (leer); horizontal, nosotros (mover).
          if (Math.abs(dx) < 8 || Math.abs(dx) <= Math.abs(dy)) return
          g.activo = true
          g.linea.style.position = 'relative'
          g.guia = document.createElement('span')
          Object.assign(g.guia.style, {
            position: 'absolute',
            top: '0',
            bottom: '0',
            width: '2px',
            borderRadius: '1px',
            background: 'var(--color-acorde)',
            opacity: '0.85',
            pointerEvents: 'none',
          })
          g.linea.appendChild(g.guia)
          g.btn.style.backgroundColor = 'var(--color-superficie-alta)'
          g.btn.style.borderRadius = '3px'
        }
        const pasos = Math.round(dx / g.charW)
        g.destino = Math.max(g.min, Math.min(g.max, g.col0 + pasos))
        g.btn.style.transform = `translateX(${(g.destino - g.col0) * g.charW}px)`
        if (g.guia) g.guia.style.left = `${g.destino * g.charW}px`
      }}
      onPointerUp={(e) => {
        const actual = gesto.current
        if (!actual || e.pointerId !== actual.pointerId) return
        const g = terminar()
        if (!g) return
        if (!g.activo) return // fue un toque: el clic sigue su camino
        arrastroReciente.current = Date.now()
        if (g.destino === g.col0 || !arrastre) return
        iniciar(async () => {
          const r = await corregirAcorde({
            cantoId: arrastre.cantoId,
            transposicion: arrastre.transposicion,
            vista: arrastre.vista,
            correccion: { tipo: 'mover', indice: g.indice, columna: g.destino },
          })
          setError(r.ok ? null : r.error)
          router.refresh()
        })
      }}
      onPointerCancel={() => {
        terminar()
      }}
      onClick={(e) => {
        if (Date.now() - arrastroReciente.current < 500) return
        const objetivo = e.target as HTMLElement
        const boton = objetivo.closest<HTMLElement>('[data-acorde]')
        if (boton?.dataset.acorde) {
          const indice = Number(boton.dataset.indice)
          abrirEn(boton.dataset.acorde, Number.isInteger(indice) ? indice : undefined)
          return
        }
        // Un control que no es un acorde (quién canta, «Corregir») no abre nada.
        if (objetivo.closest('button, a, input, select, textarea')) return
        // 2026-11-20 · El dueño: «las notas están muy difíciles de agarrar».
        // Toda la fila de acordes abre el acorde MÁS CERCANO al dedo: no hay
        // que acertarle a la letra del acorde, alcanza con tocar esa línea.
        const fila = objetivo.closest<HTMLElement>('[data-linea-acordes]')
        if (!fila) return
        let mejor: HTMLElement | null = null
        let distancia = Number.POSITIVE_INFINITY
        for (const candidato of fila.querySelectorAll<HTMLElement>('[data-acorde]')) {
          const caja = candidato.getBoundingClientRect()
          const d =
            e.clientX < caja.left
              ? caja.left - e.clientX
              : e.clientX > caja.right
                ? e.clientX - caja.right
                : 0
          if (d < distancia) {
            distancia = d
            mejor = candidato
          }
        }
        if (!mejor?.dataset.acorde) return
        const indice = Number(mejor.dataset.indice)
        abrirEn(mejor.dataset.acorde, Number.isInteger(indice) ? indice : undefined)
      }}
    >
      {error && (
        <p role="status" className="mb-2 text-sm text-peligro">
          {error}
        </p>
      )}
      {children}
    </div>
  )
}

/**
 * La hoja inferior con la tira de diagramas.
 *
 * Se apila ENCIMA de la barra de controles, que sigue accesible: hay que poder
 * transponer con la hoja abierta —es el segundo acto del "listo cuando"—. No es
 * un modal a pantalla completa porque el cifrado no se puede tapar: es lo único
 * que no se interrumpe mientras se toca.
 *
 * Es parte de la lectura, así que va sin halo, sin sombra y sin
 * `backdrop-blur`: una superficie opaca con su línea de separación, y solo
 * tokens (rediseño 2026-10-17).
 */
export function HojaDiagramas({
  children,
  pie,
}: {
  children: ReactNode
  /** H19-B · Lo que va bajo la tira: «Corregir este acorde», si se puede. */
  pie?: ReactNode
}) {
  const { foco, cerrar } = useDiagramas()
  const tira = useRef<HTMLDivElement>(null)
  const abierta = foco !== null

  useEffect(() => {
    if (!abierta) return

    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar()
    }
    document.addEventListener('keydown', alTeclado)
    return () => document.removeEventListener('keydown', alTeclado)
  }, [abierta, cerrar])

  // "Centrada en él": la carta del acorde que se tocó queda a la vista.
  useEffect(() => {
    if (foco === null) return
    const carta = tira.current?.querySelector<HTMLElement>(`[data-tarjeta="${foco}"]`)
    if (!carta) return

    const quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    carta.scrollIntoView({
      inline: 'center',
      block: 'nearest',
      behavior: quieto ? 'auto' : 'smooth',
    })
  }, [foco])

  return (
    // El envoltorio recorta. La hoja cerrada no queda "detrás" de la barra de
    // controles: está trasladada sobre ella, y como es `absolute` se pinta
    // encima aunque la barra ya sea opaca. Cuando la barra era translúcida
    // (`bg-fondo/95 backdrop-blur`, hasta el 2026-10-17) eso se veía en
    // fantasma; ahora la taparía entera. Se recorta de verdad y encima se
    // apaga con `inert`.
    <div className="pointer-events-none absolute inset-x-0 bottom-full overflow-hidden">
      <div
        // Booleano de verdad: React 19 lo serializa solo. Con `''` se leería
        // como false y la hoja cerrada seguiría siendo enfocable con el tabulador.
        inert={!abierta}
        aria-hidden={!abierta}
        className={`pointer-events-auto z-(--z-modal) border-t border-borde bg-superficie transition-transform duration-200 ease-out motion-reduce:transition-none ${
          abierta ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="mx-auto w-full max-w-2xl">
          <div className="flex items-center justify-between pt-1 pr-1 pl-4">
            <span className="text-sm text-texto-tenue">Acordes del canto</span>
            <BotonIcono etiqueta="Cerrar los diagramas" onClick={cerrar}>
              <IconoCerrar />
            </BotonIcono>
          </div>

          <div ref={tira} className="flex gap-2 overflow-x-auto px-4 pb-3">
            {children}
          </div>

          {pie}
        </div>
      </div>
    </div>
  )
}

/**
 * Cascarón de una carta. Solo marca cuál está enfocada: el dibujo llega desde
 * el servidor como `children` y no se toca.
 */
export function CascaronCarta({ indice, children }: { indice: number; children: ReactNode }) {
  const { foco } = useDiagramas()
  const enfocada = foco === indice

  return (
    <div
      data-tarjeta={indice}
      aria-current={enfocada ? 'true' : undefined}
      className={`shrink-0 rounded-lg transition-shadow ${
        // El anillo va en marfil (`--color-texto`). No en el halo: la hoja es
        // parte de la lectura, y ahí el halo no aparece porque junto al ámbar
        // se distingue solo por tono (rediseño 2026-10-17). Y nunca en
        // `--color-acorde`: ese señala el acorde, y si decora deja de señalar.
        enfocada ? 'ring-2 ring-texto' : ''
      }`}
    >
      {children}
    </div>
  )
}
