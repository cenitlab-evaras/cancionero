'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

/**
 * Búsqueda por título o autor (RF-02). El filtrado real lo hace el motor puro
 * en el servidor, que ignora acentos y mayúsculas; esto solo lleva el término
 * a la URL.
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
    <div className="relative">
      <svg
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-tenue"
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        aria-hidden
      >
        <circle cx="6" cy="6" r="4.5" />
        <path d="M9.5 9.5 13 13" strokeLinecap="round" />
      </svg>

      <input
        type="search"
        value={valor}
        onChange={(e) => buscar(e.target.value)}
        placeholder="Buscar por título o autor"
        aria-label="Buscar por título o autor"
        className="h-11 w-full rounded-lg border border-borde-fuerte bg-superficie pr-3 pl-9 text-sm transition-colors placeholder:text-texto-tenue hover:border-texto-tenue focus:border-acento"
      />
      {pendiente && <span className="sr-only">Buscando…</span>}
    </div>
  )
}
