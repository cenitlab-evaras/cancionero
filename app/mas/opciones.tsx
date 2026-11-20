import Link from 'next/link'
import type { ReactNode } from 'react'
import { IconoSeguir } from '@/app/componentes/iconos'

export type Fila = {
  href: string
  texto: string
  icono: ReactNode
}

/**
 * «Más», en una sola lista (el dueño, 2026-11-20: «replantear todo esto,
 * dejarlo mucho más simple»). Sin grupos, sin descripciones y sin lupa: son
 * pocas filas y el nombre alcanza. «Salir» cierra la lista.
 */
export default function Opciones({
  filas,
  salir,
  arriba,
}: {
  filas: Fila[]
  salir: ReactNode
  /** Lo que va bajo el título (el correo de la cuenta). */
  arriba?: ReactNode
}) {
  return (
    <>
      <h1 className="titulo-pantalla leading-tight">Más</h1>
      {arriba}

      <ul className="mt-6 border-t border-borde">
        {filas.map((f) => (
          <li key={f.href} className="border-b border-borde/70">
            <Link
              href={f.href}
              className="tactil -mx-2 flex min-h-14 items-center gap-4 rounded-lg px-2 py-2 hover:bg-superficie"
            >
              <span className="text-texto-tenue">{f.icono}</span>
              <span className="min-w-0 flex-1 truncate">{f.texto}</span>
              <IconoSeguir tamano={18} className="shrink-0 text-texto-tenue" />
            </Link>
          </li>
        ))}
        <li className="pt-4">{salir}</li>
      </ul>
    </>
  )
}
