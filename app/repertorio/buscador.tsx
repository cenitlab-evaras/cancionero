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
 */
export default function Buscador({ valorInicial }: { valorInicial: string }) {
  const router = useRouter()
  const [valor, setValor] = useState(valorInicial)
  const [pendiente, iniciarTransicion] = useTransition()

  function buscar(termino: string) {
    setValor(termino)
    iniciarTransicion(() => {
      router.replace(termino ? `/repertorio?q=${encodeURIComponent(termino)}` : '/repertorio')
    })
  }

  return (
    <>
      <TituloConLupa
        titulo="Repertorio"
        valor={valor}
        alCambiar={buscar}
        etiqueta="Buscar en el repertorio por título o autor"
        muestra="Título o autor"
      />
      {pendiente && <span className="sr-only">Buscando…</span>}
    </>
  )
}
