'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { desarchivarCanto } from '../acciones'
import type { CantoDeLista } from '@/lib/datos/repertorio'
import { clasesBotonIcono } from '@/app/componentes/boton-icono'

/**
 * Los cantos fuera de circulación, con su vuelta atrás.
 *
 * Archivar sin poder deshacer sería borrar con otro nombre, así que esta
 * pantalla no es un archivo muerto: es la mitad que hace que archivar sea una
 * decisión reversible y, por eso, una decisión fácil de tomar.
 *
 * Las filas son las del repertorio (rediseño 2026-10-17): a la izquierda solo
 * el número del cancionero, que es como el coro busca un canto de memoria, y
 * «Devolver» como control de 44 px con borde, no un texto suelto en el halo.
 */
export default function ListaArchivados({ cantos }: { cantos: CantoDeLista[] }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()

  function desarchivar(cantoId: string) {
    setError(null)
    empezar(async () => {
      const r = await desarchivarCanto(cantoId)
      if (!r.ok) {
        setError(r.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <>
      {error && (
        <p role="alert" className="mt-4 text-sm text-peligro">
          {error}
        </p>
      )}

      <ul className="mt-4 divide-y divide-borde border-t border-borde">
        {cantos.map((canto) => (
          <li key={canto.id} className="flex items-center gap-2 py-2">
            {/* Se puede abrir: un canto archivado se lee igual, y hay que
                poder mirarlo antes de decidir si vuelve. */}
            <Link
              href={`/repertorio/${canto.id}`}
              className="tactil -ml-2 flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-1 transition-colors hover:bg-superficie"
            >
              <span className="numero-libro w-7 shrink-0 text-right text-texto-tenue" aria-hidden>
                {canto.fuenteNumero ?? ''}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate">{canto.titulo}</span>
                {canto.autor && (
                  <span className="block truncate text-sm text-texto-tenue">{canto.autor}</span>
                )}
              </span>
            </Link>
            <button
              type="button"
              onClick={() => desarchivar(canto.id)}
              disabled={pendiente}
              className={clasesBotonIcono('borde', 'px-4')}
            >
              Devolver
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
