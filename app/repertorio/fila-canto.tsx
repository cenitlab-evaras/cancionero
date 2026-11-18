import Link from 'next/link'
import type { CSSProperties, ReactNode, Ref } from 'react'
import { MarcaPartitura, MarcaRepetida, MarcaSolistas } from '@/app/componentes/marcas'
import Deslizable, { type ResultadoAccion } from '@/app/componentes/deslizable'

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
  /** El número del cancionero impreso: es como el coro los busca de memoria. */
  numero: number | null
  autor: string | null
}

export default function FilaCanto({
  canto,
  asa,
  ref,
  style,
  className = '',
  como = 'li',
  deslizar,
}: {
  canto: DatosFila
  /** El asa de arrastre del director, a la derecha. */
  asa?: ReactNode
  ref?: Ref<HTMLLIElement & HTMLDivElement>
  style?: CSSProperties
  className?: string
  /** `div` cuando se dibuja fuera de la lista (la fila levantada al arrastrar). */
  como?: 'li' | 'div'
  /**
   * Solo el director: deslizar a la izquierda descubre una acción (archivar,
   * 2026-10-17). Sin esto la fila es la de siempre.
   */
  deslizar?: { texto: string; alConfirmar: () => Promise<ResultadoAccion>; alTerminar?: () => void }
}) {
  const Elemento = como
  const contenido = (
    <>
        <Link
          href={`/repertorio/${canto.id}`}
          className="tactil group -mx-2 flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-2.5 hover:bg-superficie"
        >
          {/* La estructura es la del cancionero (DESIGN.md): el número a la
              izquierda, el autor debajo del título. Sin número la columna queda
              vacía — no se inventa uno. */}
          <span className={`numero-libro w-7 shrink-0 text-right text-base ${canto.numero !== null ? 'text-texto-tenue' : ''}`}>
            {canto.numero ?? ''}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate">{canto.titulo}</span>
            {canto.autor && <span className="block truncate text-sm text-texto-tenue">{canto.autor}</span>}
          </span>
          {canto.enEnsayo && <span className="sr-only">, en ensayo</span>}
          {canto.repetida && <MarcaRepetida veces={canto.repetida} className="text-peligro" />}
        </Link>
        {/* Las marcas que abren algo son enlaces propios: la P y el micrófono
            llevan a ensayar (el dueño, 2026-10-17). */}
        {canto.partitura && (
          <Link
            href={`/repertorio/${canto.id}/ensayar`}
            aria-label={`Ensayar ${canto.titulo} con la partitura`}
            className="tactil inline-flex min-w-11 shrink-0 items-center justify-center rounded-lg px-1 text-texto-tenue hover:text-texto"
          >
            <MarcaPartitura />
          </Link>
        )}
        {canto.partitura?.solistas && (
          <Link
            href={`/repertorio/${canto.id}/ensayar`}
            aria-label={`Ensayar las estrofas de solista de ${canto.titulo}`}
            className="tactil inline-flex min-w-11 shrink-0 items-center justify-center rounded-lg px-1 text-texto-tenue hover:text-texto"
          >
            <MarcaSolistas />
          </Link>
        )}
        {canto.tonalidad && (
          <span className="w-6 shrink-0 text-right font-cifrado text-sm text-acorde">{canto.tonalidad}</span>
        )}
        {asa}
    </>
  )
  return (
    <Elemento
      ref={ref}
      style={style}
      className={`relative border-b border-borde last:border-b-0 ${deslizar ? '' : 'flex items-center gap-1'} ${className}`}
    >
      {/* «En ensayo» es una banda al costado, no una palabra ni un ícono (el
          dueño, 2026-10-17). */}
      {canto.enEnsayo && (
        <span aria-hidden className="absolute top-2 bottom-2 -left-3 w-1 rounded-full bg-acento" />
      )}
      {deslizar ? (
        // `pl-2` devuelve el margen negativo del enlace, que el recorte del
        // deslizable cortaría.
        <Deslizable {...deslizar} className="flex items-center gap-1 pl-2">
          {contenido}
        </Deslizable>
      ) : (
        contenido
      )}
    </Elemento>
  )
}
