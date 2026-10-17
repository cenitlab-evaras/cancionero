'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export type DestinoNav = {
  href: string
  texto: string
  icono: ReactNode
  /** Activo solo en la ruta exacta (Inicio es `/`, prefijo de todo). */
  exacto?: boolean
  /** Otras rutas en las que este destino cuenta como «dónde estás». */
  tambien?: string[]
}

function esActivo(aqui: string, d: DestinoNav): boolean {
  if (d.exacto) return aqui === d.href
  const bajo = (ruta: string) => aqui === ruta || aqui.startsWith(ruta + '/')
  return bajo(d.href) || (d.tambien ?? []).some(bajo)
}

/**
 * Es de cliente por una sola razón: marcar dónde estás parado.
 *
 * El lugar activo se dice con tres cosas a la vez —el halo, el peso y una
 * barra de 3 px arriba del ícono— para no depender solo del color.
 */
export default function DestinosNav({ destinos }: { destinos: DestinoNav[] }) {
  const aqui = usePathname()

  return (
    <nav
      aria-label="Secciones"
      className="barra-nav fixed inset-x-0 bottom-0 z-(--z-cabecera) border-t border-borde bg-fondo pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex h-16 w-full max-w-2xl">
        {destinos.map((d) => {
          const activo = esActivo(aqui, d)
          return (
            <li key={d.href} className="flex-1">
              <Link
                href={d.href}
                aria-current={activo ? 'page' : undefined}
                className={`relative flex h-full flex-col items-center justify-center gap-1 text-xs transition-colors ${
                  activo ? 'font-bold text-acento' : 'text-texto-tenue hover:text-texto'
                }`}
              >
                <span
                  aria-hidden
                  className={`absolute top-0 h-[3px] w-8 rounded-b-full bg-acento transition-opacity ${
                    activo ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                {d.icono}
                {d.texto}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
