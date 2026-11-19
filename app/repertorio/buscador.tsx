'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import TituloConLupa from '@/app/componentes/titulo-con-lupa'

/**
 * Búsqueda por título o autor (RF-02). El filtrado real lo hace el motor puro
 * en el servidor, que ignora acentos y mayúsculas; esto solo lleva el término
 * a la URL.
 *
 * Desde el 2026-10-17 es solo una lupa al lado del título (el dueño): el campo
 * aparece al tocarla. «Nuevo» se mudó a Herramientas.
 *
 * Con la unificación (2026-11-19) es el buscador COMPARTIDO de las dos vistas:
 * en «Por momento» escribe `/repertorio?q=…`; en «Todas» mantiene `vista=todas`
 * Y los filtros que ya estaban elegidos (momento, estado, partitura,
 * repetidas, solistas), para que buscar no los limpie, y su título pasa a ser
 * el h1 de esa vista («Todas las canciones»), así cada vista tiene un solo h1.
 */
export type FiltrosDeTodas = {
  momento?: string
  estado?: string
  partitura?: string
  repetidas?: string
  solistas?: string
}

export default function Buscador({
  valorInicial,
  vista,
  filtros,
}: {
  valorInicial: string
  vista?: 'todas'
  /** Los filtros de «Todas» ya elegidos, para reemitirlos con la búsqueda. */
  filtros?: FiltrosDeTodas
}) {
  const router = useRouter()
  const [valor, setValor] = useState(valorInicial)
  const [pendiente, iniciarTransicion] = useTransition()

  function buscar(termino: string) {
    setValor(termino)
    iniciarTransicion(() => {
      const p = new URLSearchParams()
      if (vista === 'todas') {
        p.set('vista', 'todas')
        // Los filtros son de «Todas»: acá se conservan; en «Por momento» no.
        if (filtros?.momento) p.set('momento', filtros.momento)
        if (filtros?.estado) p.set('estado', filtros.estado)
        if (filtros?.partitura) p.set('partitura', filtros.partitura)
        if (filtros?.repetidas) p.set('repetidas', filtros.repetidas)
        if (filtros?.solistas) p.set('solistas', filtros.solistas)
      }
      if (termino) p.set('q', termino)
      const qs = p.toString()
      router.replace(qs ? `/repertorio?${qs}` : '/repertorio')
    })
  }

  return (
    <>
      <TituloConLupa
        titulo={vista === 'todas' ? 'Todas las canciones' : 'Canciones'}
        valor={valor}
        alCambiar={buscar}
        etiqueta="Buscar en las canciones por título o autor"
        muestra="Título o autor"
      />
      {pendiente && <span className="sr-only">Buscando…</span>}
    </>
  )
}
