import Image from 'next/image'

/**
 * La identidad del coro: su logo en un círculo, o su monograma si no tiene.
 *
 * El logo vive como archivo estático mientras no haya dónde guardarlo por coro;
 * cuando entre Storage (PRD §21, H23) pasa a ser una columna del coro. Hasta
 * entonces la tabla de abajo es la única lista, y un coro que no está en ella
 * recibe su monograma — nunca un hueco ni un ícono genérico.
 */
const LOGOS: Record<string, string> = {
  // Coro San José de la Familia
  '1d1319ec-d4f4-4e2d-8672-271294cd20e3': '/coros/san-jose-de-la-familia.png',
}

/** Las iniciales que importan: «Coro San José de la Familia» → «SJ». */
export function monograma(nombre: string): string {
  const vacias = new Set(['coro', 'de', 'del', 'la', 'las', 'los', 'el', 'y'])
  const letras = nombre
    .split(/\s+/)
    .filter((p) => p && !vacias.has(p.toLowerCase()))
    .map((p) => p[0]!.toUpperCase())
  return (letras.slice(0, 2).join('') || nombre.slice(0, 1).toUpperCase())
}

export default function EscudoCoro({
  coroId,
  nombre,
  tamano = 32,
}: {
  coroId: string
  nombre: string
  tamano?: number
}) {
  const logo = LOGOS[coroId]

  if (logo) {
    return (
      <Image
        src={logo}
        alt=""
        width={tamano}
        height={tamano}
        // El anillo es el halo del logo continuado: un borde de 1 px en el
        // dorado, apenas, para que el círculo no se disuelva en el fondo oscuro.
        className="shrink-0 rounded-full ring-1 ring-acento/50"
        priority
      />
    )
  }

  return (
    <span
      aria-hidden
      style={{ width: tamano, height: tamano }}
      className="titulo-libro inline-flex shrink-0 items-center justify-center rounded-full bg-superficie-alta text-[0.8125rem] text-acento ring-1 ring-acento/40"
    >
      {monograma(nombre)}
    </span>
  )
}
