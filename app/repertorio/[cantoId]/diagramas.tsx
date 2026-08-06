'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

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
  abrirEn: (nombre: string) => void
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

  const abrirEn = useCallback(
    (nombre: string) => {
      const i = acordes.indexOf(nombre)
      if (i < 0) return
      // Volver a tocar el mismo acorde cierra: el gesto que abre es el que cierra.
      setFoco((actual) => (actual === i ? null : i))
    },
    [acordes]
  )

  const cerrar = useCallback(() => setFoco(null), [])

  const valor = useMemo(
    () => ({ acordes, foco, abrirEn, cerrar }),
    [acordes, foco, abrirEn, cerrar]
  )

  return <ContextoDiagramas.Provider value={valor}>{children}</ContextoDiagramas.Provider>
}

function useDiagramas() {
  const ctx = useContext(ContextoDiagramas)
  if (!ctx) throw new Error('Falta <ProveedorDiagramas> más arriba en el árbol.')
  return ctx
}

/**
 * Envuelve el cifrado y escucha los toques por DELEGACIÓN.
 *
 * Un componente cliente por acorde sería caro sin necesidad: *Himno Misión
 * País* tiene 91 corchetes. Con un solo escuchador, `cifrado.tsx` sigue siendo
 * Server Component y los acordes siguen siendo `<button>` de verdad, así que el
 * teclado funciona sin una línea extra.
 */
export function ZonaAcordes({ children }: { children: ReactNode }) {
  const { abrirEn } = useDiagramas()

  return (
    <div
      onClick={(e) => {
        const boton = (e.target as HTMLElement).closest<HTMLElement>('[data-acorde]')
        if (boton?.dataset.acorde) abrirEn(boton.dataset.acorde)
      }}
    >
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
 */
export function HojaDiagramas({ children }: { children: ReactNode }) {
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
    // El envoltorio recorta: la barra de controles es translúcida
    // (`bg-fondo/95 backdrop-blur`), así que una hoja "escondida detrás" se
    // vería en fantasma. Se recorta de verdad y encima se apaga con `inert`.
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
          <div className="flex items-center justify-between pt-1 pl-4">
            <span className="text-[0.6875rem] text-texto-tenue">Acordes del canto</span>
            <button
              onClick={cerrar}
              aria-label="Cerrar los diagramas"
              className="tactil flex w-11 items-center justify-center rounded-lg text-texto-tenue transition-colors hover:text-texto"
            >
              ✕
            </button>
          </div>

          <div ref={tira} className="flex gap-2 overflow-x-auto px-4 pb-3">
            {children}
          </div>
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
        // El anillo va en `--color-acento`, que es el token de selección. Nunca
        // en `--color-acorde`: ese señala el acorde, y si decora deja de señalar.
        enfocada ? 'ring-2 ring-acento' : ''
      }`}
    >
      {children}
    </div>
  )
}
