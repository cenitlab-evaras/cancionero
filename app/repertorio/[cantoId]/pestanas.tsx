import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * «Acordes · Partitura» — H23 (PRD §21.8: pestaña, no sección nueva). Se
 * llamaban «Cifrado · Ensayar»; el dueño les puso estos nombres el 2026-10-17.
 * La ruta sigue siendo `/ensayar`.
 *
 * Solo se dibuja si el canto tiene una partitura que esta persona puede ver:
 * un canto sin partitura no muestra «Partitura» (§21.8, estados vacíos), y con
 * una sola pestaña no hay nada que elegir. `alLado` va a la derecha del
 * renglón (el interruptor de la partitura).
 */
export default function PestanasCanto({
  cantoId,
  activa,
  alLado,
}: {
  cantoId: string
  activa: 'cifrado' | 'ensayar'
  alLado?: ReactNode
}) {
  const pestanas = [
    { clave: 'cifrado', texto: 'Acordes', href: `/repertorio/${cantoId}` },
    { clave: 'ensayar', texto: 'Partitura', href: `/repertorio/${cantoId}/ensayar` },
  ] as const

  return (
    <nav aria-label="Vistas del canto" className="mt-2 flex gap-1 border-b border-borde px-4">
      {pestanas.map((p) => {
        const actual = p.clave === activa
        return (
          <Link
            key={p.clave}
            href={p.href}
            aria-current={actual ? 'page' : undefined}
            // El lugar activo con la raya del halo, como la barra de abajo.
            className={`tactil -mb-px flex items-center border-b-2 px-3 text-sm transition-colors ${
              actual
                ? 'border-acento font-semibold text-texto'
                : 'border-transparent text-texto-tenue hover:text-texto'
            }`}
          >
            {p.texto}
          </Link>
        )
      })}
      {alLado}
    </nav>
  )
}
