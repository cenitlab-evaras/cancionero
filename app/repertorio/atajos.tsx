/**
 * Los atajos a cada momento del repertorio (2026-11-19, «una sola pantalla de
 * Canciones»). Una fila de chips que salta a la sección `#momento-<codigo>`; se
 * dibujan SOLO en la vista «Por momento» y con las secciones que realmente se
 * ven (las vacías no llegan acá: `repertorioPorMomento` no las devuelve).
 *
 * Componente de servidor a propósito: es una fila de anclas estáticas, sin
 * estado. La altura de 44 px (min-h-11) la hereda de la regla táctil del
 * producto, y el scroll horizontal se esconde para no sumar una barra más.
 */
export default function Atajos({
  momentos,
  className = '',
}: {
  momentos: { codigo: string; nombre: string }[]
  className?: string
}) {
  if (momentos.length === 0) return null

  return (
    <nav
      aria-label="Ir a un momento"
      className={`-ml-2 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {momentos.map((m) => (
        <a
          key={m.codigo}
          href={`#momento-${m.codigo}`}
          className="tactil flex min-h-11 shrink-0 items-center px-2 text-sm text-texto-tenue transition-colors hover:text-texto"
        >
          {m.nombre}
        </a>
      ))}
    </nav>
  )
}
