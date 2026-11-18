'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Deslizable from '@/app/componentes/deslizable'
import { quitarCanto } from '../acciones'

/**
 * Una fila de la lista de cantos de la misa. Para el director se desliza a la
 * izquierda y descubre «Quitar» (el dueño, 2026-10-17), sin entrar a «Armar la
 * misa». El canto sale de esta misa; sigue en el repertorio.
 */
export default function FilaCantoMisa({
  misaId,
  filaId,
  titulo,
  momento,
  tono,
  puedeQuitar,
}: {
  misaId: string
  filaId: string
  titulo: string
  momento: string
  tono: string | null
  puedeQuitar: boolean
}) {
  const router = useRouter()
  const [quitada, setQuitada] = useState(false)
  if (quitada) return null

  const fila = (
    <Link
      href={`/misas/${misaId}/${filaId}`}
      className="-mx-2 flex min-h-14 items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-superficie"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base">{titulo}</span>
        <span className="block text-sm text-texto-tenue">{momento}</span>
      </span>
      {/* H27 · el tono en que va EN ESTA MISA, si el director lo fijó; si
          no, el original del cifrado. Va en ámbar: es un acorde. */}
      {tono && <span className="shrink-0 font-cifrado text-sm text-acorde">{tono}</span>}
    </Link>
  )

  return (
    <li>
      {puedeQuitar ? (
        <Deslizable
          texto="Quitar"
          alConfirmar={() => quitarCanto({ misaId, filaId })}
          alTerminar={() => {
            setQuitada(true)
            router.refresh()
          }}
          className="px-2"
        >
          {fila}
        </Deslizable>
      ) : (
        fila
      )}
    </li>
  )
}
