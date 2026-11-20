'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { accionEnLote } from './acciones'

/**
 * Selección múltiple de canciones (el dueño, 2026-11-20: «poder hacer una
 * operación bulk como archivar, mover a misa…»). El modo se enciende desde la
 * URL (`?seleccion=1`): así las casillas solo existen cuando hacen falta y el
 * listado normal no paga 500 islas de cliente (2026-11-20, velocidad).
 *
 * La selección vive en el cliente; archivar pide confirmación en el mismo
 * botón (dos toques), como los gestos de la fila.
 */
type Estado = {
  habilitado: boolean
  ids: Set<string>
  alternar: (id: string) => void
  tiene: (id: string) => boolean
  limpiar: () => void
}

const Ctx = createContext<Estado | null>(null)

export function useSeleccion(): Estado {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('Falta <ProveedorSeleccion>')
  return ctx
}

export function ProveedorSeleccion({
  habilitado,
  children,
}: {
  habilitado: boolean
  children: ReactNode
}) {
  const [ids, setIds] = useState<Set<string>>(new Set())

  const valor = useMemo<Estado>(
    () => ({
      habilitado,
      ids,
      alternar: (id) =>
        setIds((prev) => {
          const nuevo = new Set(prev)
          if (nuevo.has(id)) nuevo.delete(id)
          else nuevo.add(id)
          return nuevo
        }),
      tiene: (id) => ids.has(id),
      limpiar: () => setIds(new Set()),
    }),
    [habilitado, ids]
  )

  return (
    <Ctx.Provider value={valor}>
      {children}
      {habilitado && <BarraLote ids={ids} limpiar={valor.limpiar} />}
    </Ctx.Provider>
  )
}

/** La casilla de una fila; no existe si el modo está apagado. */
export function CasillaSeleccion({ id, etiqueta }: { id: string; etiqueta: string }) {
  const { habilitado, tiene, alternar } = useSeleccion()
  if (!habilitado) return null
  const marcada = tiene(id)
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={marcada}
      aria-label={`Seleccionar ${etiqueta}`}
      onClick={() => alternar(id)}
      className="tactil flex size-11 shrink-0 items-center justify-center"
    >
      <span
        aria-hidden
        className={`flex size-5 items-center justify-center rounded border-2 text-sobre-acento transition-colors ${
          marcada ? 'border-acento bg-acento' : 'border-borde-fuerte bg-superficie'
        }`}
      >
        {marcada && (
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m3 8.5 3.2 3.2L13 4.8" />
          </svg>
        )}
      </span>
    </button>
  )
}

function BarraLote({ ids, limpiar }: { ids: Set<string>; limpiar: () => void }) {
  const router = useRouter()
  const [enCurso, iniciar] = useTransition()
  const [confirmando, setConfirmando] = useState(false)
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const n = ids.size

  useEffect(() => () => {
    if (temporizador.current) clearTimeout(temporizador.current)
  }, [])

  function correr(accion: 'archivar' | 'ensayo' | 'proxima') {
    if (enCurso || n === 0) return
    if (accion === 'archivar' && !confirmando) {
      setConfirmando(true)
      return
    }
    setAviso(null)
    iniciar(async () => {
      const r = await accionEnLote({ accion, cantoIds: [...ids] })
      if (!r.ok) {
        setAviso({ tipo: 'error', texto: r.error })
        setConfirmando(false)
        return
      }
      setAviso({ tipo: 'ok', texto: r.mensaje })
      setConfirmando(false)
      limpiar()
      router.refresh()
      if (temporizador.current) clearTimeout(temporizador.current)
      temporizador.current = setTimeout(() => setAviso(null), 5000)
    })
  }

  return (
    <>
      {n > 0 && (
        <div className="fixed inset-x-0 bottom-[var(--alto-barra-nav)] z-(--z-cabecera) px-4 pb-2">
          <div className="mx-auto flex max-w-2xl flex-col gap-2 rounded-2xl border border-borde-fuerte bg-superficie p-3 shadow-lg">
            <p className="text-sm font-semibold text-texto" aria-live="polite">
              {n === 1 ? '1 canción seleccionada' : `${n} canciones seleccionadas`}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => correr('ensayo')}
                disabled={enCurso}
                className="tactil min-h-11 flex-1 rounded-lg border border-borde-fuerte bg-fondo px-2 text-sm font-semibold text-texto disabled:opacity-50"
              >
                Ensayar
              </button>
              <button
                type="button"
                onClick={() => correr('proxima')}
                disabled={enCurso}
                className="tactil min-h-11 flex-1 rounded-lg border border-borde-fuerte bg-fondo px-2 text-sm font-semibold text-texto disabled:opacity-50"
              >
                Próxima misa
              </button>
              <button
                type="button"
                onClick={() => correr('archivar')}
                disabled={enCurso}
                className={`tactil min-h-11 flex-1 rounded-lg px-2 text-sm font-bold disabled:opacity-50 ${
                  confirmando ? 'bg-peligro text-sobre-peligro' : 'border border-peligro text-peligro'
                }`}
              >
                {enCurso ? '…' : confirmando ? `¿Archivar ${n}?` : 'Archivar'}
              </button>
            </div>
            {confirmando && !enCurso && (
              <button
                type="button"
                onClick={() => setConfirmando(false)}
                className="text-sm text-texto-tenue underline underline-offset-2"
              >
                Mejor no
              </button>
            )}
          </div>
        </div>
      )}

      {aviso && (
        <p
          role="status"
          className={`fixed inset-x-4 bottom-[calc(var(--alto-barra-nav)+8px)] z-(--z-cabecera) mx-auto max-w-2xl rounded-xl border px-3 py-2 text-sm shadow-lg ${
            aviso.tipo === 'error'
              ? 'border-peligro bg-superficie text-peligro'
              : 'border-acento bg-superficie text-texto'
          }`}
        >
          {aviso.texto}
        </p>
      )}
    </>
  )
}
