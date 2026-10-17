'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { CantoEncontrado } from '@/lib/datos/repertorio'
import { buscarCantosAhora } from './acciones'
import { IconoBuscar } from './iconos'

/**
 * «Buscar un canto», en la cabecera, con los resultados apareciendo mientras se
 * escribe (pedido del dueño, 2026-10-17).
 *
 * Cada letra pide la lista a una server action, con 150 ms de espera para no
 * pedir una por tecla, y una respuesta vieja que llega tarde se descarta: si no,
 * escribir rápido «fortaleza» podía terminar mostrando lo que encontraba «fo».
 *
 * Sigue siendo un formulario GET a `/repertorio?q=`: Enter, o sin JavaScript,
 * lleva al repertorio filtrado. La lista es un atajo para entrar a un canto.
 */
const ESPERA_MS = 150

export default function BuscadorGlobal() {
  const [termino, setTermino] = useState('')
  const [resultados, setResultados] = useState<CantoEncontrado[] | null>(null)
  const [abierto, setAbierto] = useState(false)
  const pedido = useRef(0)
  const espera = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const caja = useRef<HTMLFormElement>(null)

  function escribir(valor: string) {
    setTermino(valor)
    setAbierto(true)
    clearTimeout(espera.current)
    const t = valor.trim()
    const este = ++pedido.current
    if (t === '') {
      setResultados(null)
      return
    }
    espera.current = setTimeout(async () => {
      const r = await buscarCantosAhora(t)
      if (este === pedido.current) setResultados(r)
    }, ESPERA_MS)
  }

  useEffect(() => () => clearTimeout(espera.current), [])

  // Tocar fuera la cierra; el foco que sale a un resultado no.
  useEffect(() => {
    if (!abierto) return
    const fuera = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false)
    }
    document.addEventListener('pointerdown', fuera)
    return () => document.removeEventListener('pointerdown', fuera)
  }, [abierto])

  const mostrar = abierto && termino.trim() !== '' && resultados !== null

  return (
    <form
      ref={caja}
      action="/repertorio"
      role="search"
      className="relative mx-auto w-full max-w-2xl px-4 pt-3"
      onKeyDown={(e) => e.key === 'Escape' && setAbierto(false)}
    >
      <label className="relative block">
        <span className="sr-only">Buscar un canto por título, autor o número</span>
        <IconoBuscar
          tamano={18}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-tenue"
        />
        {/* `text-base`: con menos de 16 px, Safari de iPhone agranda la página al enfocar. */}
        <input
          type="search"
          name="q"
          value={termino}
          onChange={(e) => escribir(e.target.value)}
          onFocus={() => setAbierto(true)}
          placeholder="Buscar un canto"
          enterKeyHint="search"
          autoComplete="off"
          className="h-11 w-full rounded-lg border border-borde-fuerte bg-superficie pr-3 pl-10 text-base transition-colors placeholder:text-texto-tenue hover:border-texto-tenue focus:border-acento"
        />
      </label>

      {mostrar && (
        <div
          id="resultados-busqueda"
          className="absolute inset-x-4 top-full z-(--z-modal) mt-1 max-h-[60vh] overflow-y-auto rounded-lg border border-borde-fuerte bg-superficie"
        >
          {resultados.length === 0 ? (
            <p role="status" className="px-4 py-3 text-sm text-texto-tenue">
              Ningún canto con «{termino.trim()}».
            </p>
          ) : (
            <ul aria-label="Cantos encontrados" className="divide-y divide-borde">
              {resultados.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/repertorio/${c.id}`}
                    onClick={() => setAbierto(false)}
                    className="tactil flex items-center gap-3 px-3 py-2 hover:bg-superficie-alta"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{c.titulo}</span>
                      {c.autor && <span className="block truncate text-sm text-texto-tenue">{c.autor}</span>}
                    </span>
                    {c.tonalidadOriginal && (
                      <span className="shrink-0 font-cifrado text-sm text-acorde">{c.tonalidadOriginal}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href={`/repertorio?q=${encodeURIComponent(termino.trim())}`}
            onClick={() => setAbierto(false)}
            className="tactil flex items-center border-t border-borde px-4 text-sm text-acento underline underline-offset-2"
          >
            Ver todo en el repertorio
          </Link>
        </div>
      )}
    </form>
  )
}
