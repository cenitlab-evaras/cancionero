'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { IconoBuscar } from '@/app/componentes/iconos'

/**
 * Búsqueda por título o autor (RF-02). El filtrado real lo hace el motor puro
 * en el servidor, que ignora acentos y mayúsculas; esto solo lleva el término
 * a la URL.
 *
 * El campo va en `text-base` y no en `text-sm`: con menos de 16 px, Safari de
 * iPhone agranda la página al enfocarlo y hay que deshacer el zoom a mano. Por
 * eso el texto de muestra es corto: a 16 px y al lado de «Nuevo», el largo se
 * cortaba en un teléfono de 360. El nombre accesible sigue siendo el completo.
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
      <IconoBuscar
        tamano={18}
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-tenue"
      />

      <input
        type="search"
        value={valor}
        onChange={(e) => buscar(e.target.value)}
        placeholder="Título o autor"
        aria-label="Buscar por título o autor"
        className="h-11 w-full rounded-lg border border-borde-fuerte bg-superficie pr-3 pl-10 text-base transition-colors placeholder:text-texto-tenue hover:border-texto-tenue focus:border-acento"
      />
      {pendiente && <span className="sr-only">Buscando…</span>}
    </div>
  )
}
