import Link from 'next/link'
import type { CSSProperties, ReactNode, Ref } from 'react'
import { MarcaPartitura, MarcaRepetida, MarcaSolistas } from '@/app/componentes/marcas'

/**
 * Una fila del repertorio: el título que abre el canto y sus marcas.
 *
 * Sin hooks a propósito: la dibuja el servidor para el miembro (lista quieta)
 * y la isla del director (`repertorio-ordenable.tsx`) para arrastrarla. Así el
 * marcado de la fila vive en un solo lugar y las dos listas no se separan.
 */

/** Lo que la fila necesita saber de un canto, ya calculado al leer. */
export type DatosFila = {
  id: string
  titulo: string
  /** H10 · solo se marca lo que dice algo: «en ensayo». */
  enEnsayo: boolean
  /** Cuántas veces está la misma canción cargada; nulo si una sola. */
  repetida: number | null
  /** H23 · si tiene partitura para ensayar, y si trae estrofas de solista. */
  partitura: { solistas: boolean } | null
  tonalidad: string | null
}

export default function FilaCanto({
  canto,
  asa,
  ref,
  style,
  className = '',
  como = 'li',
}: {
  canto: DatosFila
  /** El asa de arrastre del director, a la derecha. */
  asa?: ReactNode
  ref?: Ref<HTMLLIElement & HTMLDivElement>
  style?: CSSProperties
  className?: string
  /** `div` cuando se dibuja fuera de la lista (la fila levantada al arrastrar). */
  como?: 'li' | 'div'
}) {
  const Elemento = como
  return (
    <Elemento
      ref={ref}
      style={style}
      className={`relative flex items-center gap-1 border-b border-borde last:border-b-0 ${className}`}
    >
      {/* «En ensayo» es una banda al costado, no una palabra ni un ícono (el
          dueño, 2026-10-17). */}
      {canto.enEnsayo && (
        <span aria-hidden className="absolute top-2 bottom-2 -left-3 w-1 rounded-full bg-acento" />
      )}
      <Link
        href={`/repertorio/${canto.id}`}
        className="tactil group -mx-2 flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2.5 hover:bg-superficie"
      >
        {/* Solo el título: sin número ni autor (se ven al abrirlo). */}
        <span className="truncate">{canto.titulo}</span>
        {canto.enEnsayo && <span className="sr-only">, en ensayo</span>}
        {canto.repetida && <MarcaRepetida veces={canto.repetida} className="text-peligro" />}
      </Link>
      {/* Las marcas que abren algo son enlaces propios: la P y el micrófono
          llevan a ensayar (el dueño, 2026-10-17). */}
      {canto.partitura && (
        <Link
          href={`/repertorio/${canto.id}/ensayar`}
          aria-label={`Ensayar ${canto.titulo} con la partitura`}
          className="tactil inline-flex shrink-0 items-center justify-center rounded-lg px-1 text-texto-tenue hover:text-texto"
        >
          <MarcaPartitura />
        </Link>
      )}
      {canto.partitura?.solistas && (
        <Link
          href={`/repertorio/${canto.id}/ensayar`}
          aria-label={`Ensayar las estrofas de solista de ${canto.titulo}`}
          className="tactil inline-flex shrink-0 items-center justify-center rounded-lg px-1 text-texto-tenue hover:text-texto"
        >
          <MarcaSolistas />
        </Link>
      )}
      {canto.tonalidad && (
        <span className="w-6 shrink-0 text-right font-cifrado text-sm text-acorde">{canto.tonalidad}</span>
      )}
      {asa}
    </Elemento>
  )
}
