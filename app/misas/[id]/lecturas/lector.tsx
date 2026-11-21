'use client'

import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { LecturaGuardada } from '@/lib/datos/lecturas'
import { NOMBRE_DE_PARTE, type TipoDeLectura } from '@/lib/motores/lecturas'
import { TAMANO_MAX, TAMANO_MIN, cambiarTamano } from '@/lib/motores/tamano-letra'
import { guardarTamanoLetra } from '@/app/repertorio/[cantoId]/acciones'
import PantallaEncendida from '@/app/componentes/pantalla-encendida'
import { BotonIcono } from '@/app/componentes/boton-icono'
import { IconoCerrar } from '@/app/componentes/iconos'

/**
 * Rótulos cortos de las pestañas, como en el diseño («1.ª», «Salmo», «2.ª»,
 * «Evangelio»). `NOMBRE_DE_PARTE` sigue siendo la fuente del nombre largo: acá
 * se usa en el nombre accesible de cada pestaña. Lo comparte el bloque, que
 * muestra las referencias con el mismo rótulo.
 */
export const ROTULO_CORTO: Record<TipoDeLectura, string> = {
  primera: '1.ª',
  salmo: 'Salmo',
  segunda: '2.ª',
  evangelio: 'Evangelio',
}

/**
 * El lector a pantalla completa — H30, docs/PRD.md §9.
 *
 * Es un `<dialog>` reutilizable con un contrato controlado: otra pantalla (la
 * ejecución, Task 7) lo monta con las mismas props y no vuelve a escribir el
 * `<dialog>`. No hace fetch: todo le llega por props, así que sigue funcionando
 * sin red.
 *
 * El tamaño de letra es de la persona y se guarda con `guardarTamanoLetra` (el
 * mismo control «Aa» del repertorio). `PantallaEncendida` adentro, para que el
 * teléfono no se apague a mitad de lectura. Esc y el clic fuera del contenido
 * cierran.
 */
export default function Lector({
  abierto,
  onCerrar,
  partes,
  titulo,
  tamanoLetra,
}: {
  abierto: boolean
  onCerrar: () => void
  /** Solo las partes presentes, en el orden litúrgico en que se leen. */
  partes: LecturaGuardada[]
  /** El título de la cabecera (normalmente el nombre de la misa). */
  titulo: string
  /** El tamaño de letra de la persona, en px. */
  tamanoLetra: number
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const router = useRouter()
  const [, iniciar] = useTransition()
  const [optimista, aplicar] = useOptimistic(tamanoLetra)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ajustando, setAjustando] = useState(false)
  const [activa, setActiva] = useState(0)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (abierto && !dialog.open) dialog.showModal()
    else if (!abierto && dialog.open) dialog.close()
  }, [abierto])

  // Al cerrar se deja todo como estaba: la próxima apertura parte de la primera
  // parte, sin el ajuste de letra abierto ni avisos de la vez anterior.
  function cerrar() {
    setActiva(0)
    setAjustando(false)
    setAviso(null)
    onCerrar()
  }

  function ajustar(direccion: 1 | -1) {
    const siguiente = cambiarTamano(optimista, direccion)
    if (siguiente === optimista) return
    iniciar(async () => {
      aplicar(siguiente)
      const r = await guardarTamanoLetra(siguiente)
      if (!r.ok) setAviso(r.error ?? 'No se guardó el tamaño de letra.')
      router.refresh()
    })
  }

  const parte = partes[Math.min(activa, partes.length - 1)]

  return (
    <dialog
      ref={ref}
      aria-label="Lecturas"
      onCancel={(e) => {
        e.preventDefault()
        cerrar()
      }}
      onClick={(e) => {
        if (e.target === ref.current) cerrar()
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-fondo p-0 text-texto"
    >
      <div className="flex h-full flex-col">
        <header className="flex min-h-11 items-center gap-1 border-b border-borde px-2">
          <BotonIcono etiqueta="Cerrar el lector" onClick={cerrar}>
            <IconoCerrar />
          </BotonIcono>
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold">{titulo}</h2>

          {/* El tamaño de letra: el mismo control «Aa» del repertorio. */}
          <div className="relative shrink-0">
            {ajustando && (
              <div className="absolute right-0 top-[calc(100%+8px)] flex items-center gap-1 rounded-lg border border-borde-fuerte bg-superficie p-1.5">
                <BotonIcono
                  etiqueta={`Achicar la letra, ahora en ${optimista}`}
                  apariencia="borde"
                  disabled={optimista <= TAMANO_MIN}
                  onClick={() => ajustar(-1)}
                >
                  <span className="text-sm font-bold" aria-hidden>
                    A
                  </span>
                </BotonIcono>
                <span className="w-9 text-center text-sm font-bold tabular-nums" aria-live="polite">
                  {optimista}
                </span>
                <BotonIcono
                  etiqueta={`Agrandar la letra, ahora en ${optimista}`}
                  apariencia="borde"
                  disabled={optimista >= TAMANO_MAX}
                  onClick={() => ajustar(1)}
                >
                  <span className="text-xl font-bold" aria-hidden>
                    A
                  </span>
                </BotonIcono>
              </div>
            )}
            <button
              type="button"
              onClick={() => setAjustando(!ajustando)}
              aria-expanded={ajustando}
              aria-label={`Tamaño de letra, ahora en ${optimista}`}
              className={`tactil flex h-11 items-center justify-center gap-1 rounded-lg border border-borde-fuerte px-2.5 text-sm font-bold ${
                ajustando ? 'border-texto bg-superficie-alta' : ''
              }`}
            >
              <span aria-hidden>Aa</span>
              <span className="tabular-nums">{optimista}</span>
            </button>
          </div>
        </header>

        <div role="tablist" aria-label="Partes de la lectura" className="flex border-b border-borde">
          {partes.map((p, i) => (
            <button
              key={p.tipo}
              type="button"
              role="tab"
              id={`lectura-tab-${p.tipo}`}
              aria-selected={i === activa}
              aria-controls={`lectura-panel-${p.tipo}`}
              aria-label={NOMBRE_DE_PARTE[p.tipo]}
              onClick={() => setActiva(i)}
              className={`tactil shrink-0 border-b-2 px-3 text-sm ${
                i === activa
                  ? 'border-acento font-semibold text-texto'
                  : 'border-transparent text-texto-tenue hover:text-texto'
              }`}
            >
              {ROTULO_CORTO[p.tipo]}
            </button>
          ))}
        </div>

        {parte && (
          <div
            role="tabpanel"
            id={`lectura-panel-${parte.tipo}`}
            aria-labelledby={`lectura-tab-${parte.tipo}`}
            className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
          >
            {parte.referencia !== '' && (
              <p className="text-base font-semibold text-texto-tenue">{parte.referencia}</p>
            )}
            <div
              className="mt-3 whitespace-pre-line leading-relaxed"
              style={{ fontSize: optimista }}
            >
              {parte.texto}
            </div>
          </div>
        )}

        {parte && (
          <footer className="border-t border-borde px-4 py-2">
            {aviso && (
              <p role="status" className="text-sm text-peligro">
                {aviso}
              </p>
            )}
            <p className="text-sm text-texto-tenue">
              {parte.fuente === 'iglesia.cl' ? (
                parte.fuenteUrl ? (
                  <a
                    href={parte.fuenteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:text-texto"
                  >
                    Fuente: Iglesia.cl · Eucaristía Diaria
                  </a>
                ) : (
                  'Fuente: Iglesia.cl · Eucaristía Diaria'
                )
              ) : (
                'Editada a mano'
              )}
            </p>
          </footer>
        )}

        {abierto && <PantallaEncendida />}
      </div>
    </dialog>
  )
}
