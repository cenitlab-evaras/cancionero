'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  PIXELES,
  TAMANOS,
  presetDePixeles,
  type TamanoDeLetra,
} from '@/lib/motores/tamano-letra'
import { guardarTamanoLetra } from '@/app/repertorio/[cantoId]/acciones'
import { BotonIcono } from './boton-icono'
import { IconoCerrar, IconoLista, IconoListo } from './iconos'

/**
 * Las hojas del lector (rediseño de lectura, H31).
 *
 * Acá viven las dos bandejas que se abren desde el lector de una tarea, porque
 * las dos comparten la misma forma: un `<dialog>` nativo que sube desde abajo,
 * con su título, su X y el clic-afuera para cerrar (el mismo patrón de
 * `ayuda.tsx`).
 *
 *   · `HojaTamano` — los tres presets reales de letra. El número que se guarda
 *     es el píxel del preset (task 2); el que se ve, el mismo. Se llama desde
 *     `Controles` (lectura del repertorio) y desde la barra fija de la misa.
 *   · `HojaPartes` — los cantos de la misa, para saltar a otro sin volver al
 *     listado. Se dispara desde el ícono de lista de la barra de arriba.
 *
 * El diálogo modal detiene el auto-scroll de fondo mientras está abierto:
 * `useAutoScroll` saltea los cuadros con un `dialog[open]` en el documento.
 */

const NOMBRES: Record<TamanoDeLetra, string> = {
  pequeno: 'Pequeño',
  regular: 'Regular',
  grande: 'Grande',
}

export type CantoDeLaHoja = {
  id: string
  titulo: string
  momentoNombre: string
  /** La tonalidad en que va en esta misa, o `null` si el canto no declara una. */
  tono: string | null
}

/**
 * El cascarón de una hoja inferior. Controlado: la pantalla decide si está
 * abierta y qué pasa al cerrarla; acá solo se sincroniza con el `<dialog>`.
 */
function Hoja({
  abierto,
  onCerrar,
  titulo,
  children,
}: {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const tituloId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (abierto && !dialog.open) dialog.showModal()
    else if (!abierto && dialog.open) dialog.close()
  }, [abierto])

  return (
    <dialog
      ref={ref}
      aria-labelledby={tituloId}
      onCancel={(e) => {
        e.preventDefault()
        onCerrar()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCerrar()
      }}
      className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border-t border-borde-fuerte bg-superficie p-0 text-texto"
    >
      <div className="mx-auto w-full max-w-2xl">
        <div className="sticky top-0 flex items-center gap-2 border-b border-borde bg-superficie px-4 py-1">
          <h2 id={tituloId} className="min-w-0 flex-1 text-base font-semibold">
            {titulo}
          </h2>
          <BotonIcono etiqueta="Cerrar" onClick={onCerrar}>
            <IconoCerrar />
          </BotonIcono>
        </div>
        <div className="px-4 pt-3 pb-6">{children}</div>
      </div>
    </dialog>
  )
}

/**
 * Pequeño 18 · Regular 22 · Grande 28, con tilde en el que está puesto.
 *
 * `actual` llega en píxeles (lo que hay en la columna, ya normalizado por
 * `preferenciasDelPerfil`). Elegir guarda el píxel del preset y cierra; si el
 * tamaño no cambia, solo cierra. Un error se dice dentro de la hoja y no la
 * cierra: si no se guardó, la persona tiene que enterarse.
 */
export default function HojaTamano({
  abierto,
  onCerrar,
  actual,
}: {
  abierto: boolean
  onCerrar: () => void
  /** El tamaño vigente, en px. */
  actual: number
}) {
  const router = useRouter()
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const activo = presetDePixeles(actual)

  function cerrar() {
    // Mientras se guarda, el clic-afuera y Esc no cierran: la hoja se va con
    // el resultado, no antes.
    if (guardando) return
    setError(null)
    onCerrar()
  }

  async function elegir(tamano: TamanoDeLetra) {
    if (guardando) return
    const px = PIXELES[tamano]
    if (px === actual) {
      cerrar()
      return
    }

    setError(null)
    setGuardando(true)
    let guardado = false
    try {
      const r = await guardarTamanoLetra(px)
      if (!r.ok) {
        setError(r.error)
        return
      }
      guardado = true
    } catch {
      // Una red caída o una sesión vencida rechazan la promesa: se dice acá y
      // se deja la hoja cerrable, en vez de quedar con `guardando` en true.
      setError('No se pudo guardar el tamaño. Intenta de nuevo.')
    } finally {
      // Pase lo que pase, los presets vuelven a estar disponibles y la X, Esc
      // y el clic-afuera vuelven a cerrar.
      setGuardando(false)
    }

    if (!guardado) return
    // El cierre exitoso no pasa por el guard de `guardando`: en este render el
    // estado todavía es `true` cuando la action termina.
    setError(null)
    onCerrar()
    // El tamaño vale para el canto, la misa y el repertorio que se abra después.
    router.refresh()
  }

  return (
    <Hoja abierto={abierto} onCerrar={cerrar} titulo="Tamaño de letra">
      <p className="text-sm text-texto-tenue">Se guarda para ti en este teléfono.</p>

      <ul className="mt-1">
        {TAMANOS.map((tamano) => {
          const elegido = tamano === activo
          return (
            <li key={tamano}>
              <button
                type="button"
                onClick={() => elegir(tamano)}
                disabled={guardando}
                aria-pressed={elegido}
                className="tactil flex min-h-[54px] w-full items-center gap-3 border-b border-borde py-2 text-left disabled:opacity-60"
              >
                <span
                  aria-hidden
                  className="w-11 shrink-0 text-center font-cifrado leading-none"
                  style={{ fontSize: PIXELES[tamano] }}
                >
                  Aa
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base">{NOMBRES[tamano]}</span>
                  <span className="block text-sm text-texto-tenue">{PIXELES[tamano]} px</span>
                </span>
                {elegido && <IconoListo tamano={20} className="shrink-0 text-acento" />}
              </button>
            </li>
          )
        })}
      </ul>

      {error && (
        <p role="alert" className="mt-3 text-sm text-peligro">
          {error}
        </p>
      )}
    </Hoja>
  )
}

/**
 * Los cantos de la misa, en su orden guardado, con el actual marcado.
 *
 * Es autónoma como `Ayuda`: dibuja su botón (la lista de la barra de arriba) y
 * su hoja. Al tocar un canto se cierra y `Link` navega; el lector no se recarga
 * a mano ni se pierde la posición del scroll del listado.
 */
export function HojaPartes({
  misaId,
  cantos,
  actualId,
}: {
  misaId: string
  cantos: CantoDeLaHoja[]
  /** El id de la fila que se está leyendo. */
  actualId: string
}) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <BotonIcono
        etiqueta="Cantos de la misa"
        aria-expanded={abierto}
        onClick={() => setAbierto(true)}
      >
        <IconoLista />
      </BotonIcono>

      <Hoja abierto={abierto} onCerrar={() => setAbierto(false)} titulo="Cantos de la misa">
        <ol className="mt-1">
          {cantos.map((canto, i) => {
            const actual = canto.id === actualId
            return (
              <li key={canto.id}>
                <Link
                  href={`/misas/${misaId}/${canto.id}`}
                  onClick={() => setAbierto(false)}
                  aria-current={actual ? 'page' : undefined}
                  className={`tactil -mx-2 flex min-h-[54px] items-center gap-3 rounded-lg border-b border-borde px-2 py-2 ${
                    actual ? 'bg-superficie-alta' : 'hover:bg-superficie'
                  }`}
                >
                  <span className="w-6 shrink-0 text-sm font-bold text-texto-tenue tabular-nums">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.6875rem] text-texto-tenue">
                      {canto.momentoNombre}
                    </span>
                    <span className="block truncate">{canto.titulo}</span>
                  </span>
                  {canto.tono && (
                    <span className="shrink-0 font-cifrado text-sm text-acorde">{canto.tono}</span>
                  )}
                </Link>
              </li>
            )
          })}
        </ol>
      </Hoja>
    </>
  )
}
