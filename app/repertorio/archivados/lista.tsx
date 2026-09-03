'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { desarchivarCanto } from '../acciones'
import type { CantoDeLista } from '@/lib/datos/repertorio'

/**
 * Los cantos fuera de circulación, con su vuelta atrás.
 *
 * Archivar sin poder deshacer sería borrar con otro nombre, así que esta
 * pantalla no es un archivo muerto: es la mitad que hace que archivar sea una
 * decisión reversible y, por eso, una decisión fácil de tomar.
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
          <li key={canto.id} className="flex min-h-14 items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              {/* Se puede abrir: un canto archivado se lee igual, y hay que
                  poder mirarlo antes de decidir si vuelve. */}
              <Link href={`/repertorio/${canto.id}`} className="block truncate text-sm">
                {canto.titulo}
              </Link>
              {canto.autor && (
                <span className="block truncate text-xs text-texto-tenue">{canto.autor}</span>
              )}
            </span>
            <button
              type="button"
              onClick={() => desarchivar(canto.id)}
              disabled={pendiente}
              className="tactil shrink-0 rounded-lg px-3 text-sm text-acento disabled:opacity-40"
            >
              Devolver
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
