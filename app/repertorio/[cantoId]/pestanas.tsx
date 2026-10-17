import Link from 'next/link'

/**
 * «Cifrado · Ensayar» — H23 (PRD §21.8: pestaña, no sección nueva).
 *
 * Solo se dibuja si el canto tiene una partitura que esta persona puede ver:
 * un canto sin partitura no muestra «Ensayar» (§21.8, estados vacíos), y con
 * una sola pestaña no hay nada que elegir.
 */
export default function PestanasCanto({
  cantoId,
  activa,
}: {
  cantoId: string
  activa: 'cifrado' | 'ensayar'
}) {
  const pestanas = [
    { clave: 'cifrado', texto: 'Cifrado', href: `/repertorio/${cantoId}` },
    { clave: 'ensayar', texto: 'Ensayar', href: `/repertorio/${cantoId}/ensayar` },
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
    </nav>
  )
}
