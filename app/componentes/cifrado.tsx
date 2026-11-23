'use client'

import { useEffect, useRef, useState } from 'react'
import { renderizarCifrado, type LineaCifrado } from '@/lib/motores/renderizar-cifrado'
import { columnasPara } from '@/lib/motores/cifrado-ancho'
import {
  atenuarParaMiCuerda,
  nombreDeQuienCanta,
  type QuienCanta,
} from '@/lib/motores/quien-canta'
import type { CuerdaDelCoro } from '@/lib/motores/cuerdas'

/**
 * Pinta el cifrado con los acordes sobre la letra (H2, RF-17).
 *
 * La posición de cada acorde ya viene calculada y probada en
 * `renderizar-cifrado.test.ts`. Lo que SÍ decide acá es el reparto en líneas:
 * mide el contenedor y le pide a `columnasPara` cuántas columnas entran, para
 * que la letra se parta sin encogerse del tamaño elegido.
 *
 * Dos cosas sostienen la alineación:
 *   1. Tipografía monoespaciada. En una proporcional esto no funcionaría.
 *   2. La línea de acordes se rellena con espacios hasta la columna que toca.
 *
 * Y el ajuste de línea: el cifrado se parte a las columnas que ENTRAN en el
 * ancho medido del contenedor, manteniendo la letra al tamaño pedido. La letra
 * nunca se encoge; el reflow lo hacen las columnas — así el preset de tamaño
 * se ve de verdad, también en un teléfono de 360 px.
 */

/**
 * Ancho de partida antes de medir. Es el ancho útil de un teléfono de 360 px
 * (360 − los 2×16 px de `px-4`), el caso más común. El observer lo corrige en
 * cuanto monta; esto solo evita que el primer render use la columna del
 * servidor sin dato.
 */
const ANCHO_INICIAL = 328

/**
 * Las herramientas que tocan el cifrado (2026-10-17), ya resueltas por la
 * página: qué prendió la persona, su cuerda y si puede marcar.
 */
export type HerramientasDelCifrado = {
  /** «Acordes en Do-Re-Mi». */
  latina: boolean
  /** «Quién canta cada estrofa». */
  quienCanta: boolean
  /** «Resaltar lo que canta mi cuerda». */
  resaltarMiCuerda: boolean
  /** La cuerda de su tesitura; null si no la cargó en «Mi perfil». */
  miCuerda: CuerdaDelCoro | null
  /**
   * Solo el director, y solo con «Quién canta» prendida. Lo usa la PÁGINA para
   * ofrecer el marcado al pie (2026-11-17); el cifrado ya NO dibuja selects:
   * solo el rótulo de lectura.
   */
  marcar: { cantoId: string } | null
}

/**
 * El color de la franja. Las cuatro cuerdas tienen su token (los mismos de
 * Ensayar); mujeres y hombres son sus dos cuerdas en degradé, para que se lea
 * que son dos. El nombre va escrito igual: el color solo no alcanza.
 */
const FRANJA: Record<QuienCanta, string> = {
  todos: 'var(--color-texto-tenue)',
  mujeres: 'linear-gradient(var(--color-soprano), var(--color-contralto))',
  hombres: 'linear-gradient(var(--color-tenor), var(--color-bajo))',
  solista: 'var(--color-acento)',
  soprano: 'var(--color-soprano)',
  contralto: 'var(--color-contralto)',
  tenor: 'var(--color-tenor)',
  bajo: 'var(--color-bajo)',
}

/** Las líneas en bloques: cada estrofa junta, y cada separador suelto. */
function enBloques(lineas: LineaCifrado[]): { estrofa: number; lineas: LineaCifrado[] }[] {
  const bloques: { estrofa: number; lineas: LineaCifrado[] }[] = []
  for (const l of lineas) {
    const ultimo = bloques.at(-1)
    if (l.estrofa >= 0 && ultimo && ultimo.estrofa === l.estrofa) ultimo.lineas.push(l)
    else bloques.push({ estrofa: l.estrofa, lineas: [l] })
  }
  return bloques
}

export default function Cifrado({
  cifrado,
  tamano = 16,
  mostrarAcordes = true,
  herramientas,
}: {
  cifrado: string
  tamano?: number
  /** H11 · en `false` el motor devuelve la letra sola: no hay acordes que pintar. */
  mostrarAcordes?: boolean
  herramientas?: HerramientasDelCifrado
}) {
  const contenedor = useRef<HTMLDivElement>(null)
  const [ancho, setAncho] = useState(ANCHO_INICIAL)

  // El ancho real del contenedor manda el reflow. Se mide con ResizeObserver y
  // no con `100cqi` porque las columnas se deciden en JS (`partirAlAncho`), no
  // en CSS: hay que saber el ancho para cortar la letra, no solo para pintarla.
  useEffect(() => {
    const nodo = contenedor.current
    if (!nodo) return

    const observer = new ResizeObserver(([entrada]) => {
      setAncho(entrada.contentRect.width)
    })
    observer.observe(nodo)
    return () => observer.disconnect()
  }, [])

  const columnas = columnasPara(tamano, ancho)
  const { lineas, quienCanta } = renderizarCifrado(cifrado, {
    ancho: columnas,
    mostrarAcordes,
    latina: herramientas?.latina,
  })

  const verQuien = !!herramientas?.quienCanta
  const resaltar = !!herramientas?.resaltarMiCuerda

  function pintarLinea(linea: LineaCifrado, i: number) {
    if (linea.esSeparador) return <div key={i} className="h-4" aria-hidden />

    if (linea.esComentario) {
      return (
        <div key={i} className="mt-3 italic text-texto-tenue">
          {linea.texto}
        </div>
      )
    }

    // La línea de acordes: relleno de espacios hasta cada columnaPintada, y
    // el acorde dentro de un <button> para poder tocarlo (H5).
    //
    // El relleno sigue siendo espacios literales bajo `white-space: pre`,
    // exactamente como el `padEnd` que había antes: la columna la sigue
    // decidiendo `columnaPintada`, que ya está probada. El botón no puede
    // cambiar la métrica — de eso se ocupa `.acorde-tocable` en globals.css.
    //
    // En Do-Re-Mi se ve `a.acorde` (latina) y el diagrama busca el americano.
    let cursor = 0

    return (
      // `data-linea-cifrado` y `data-columna` los usa el arrastre del director
      // (ZonaAcordes): el acorde arrastrado sabe su columna y sus vecinos.
      <div key={i} data-linea-cifrado>
        {linea.acordes.length > 0 && (
          <div data-linea-acordes className="whitespace-pre font-semibold text-acorde">
            {linea.acordes.map((a, j) => {
              const relleno = ' '.repeat(Math.max(0, a.columnaPintada - cursor))
              cursor = a.columnaPintada + a.acorde.length
              return (
                <span key={j}>
                  {relleno}
                  <button
                    type="button"
                    data-acorde={a.americano ?? a.acorde}
                    data-indice={a.indice}
                    data-columna={a.columna}
                    className="acorde-tocable"
                  >
                    {a.acorde}
                  </button>
                </span>
              )
            })}
          </div>
        )}
        <div data-letra className="whitespace-pre text-texto">{linea.texto || ' '}</div>
      </div>
    )
  }

  // El `container-type` va en el PADRE y es el nodo que se mide: las columnas
  // salen de su ancho, y el hijo solo pinta. La letra queda al px pedido: si no
  // entra, `columnasPara` devuelve menos columnas y la letra se parte.
  return (
    <div ref={contenedor} style={{ containerType: 'inline-size' }}>
      <div
        className="cifrado"
        style={{ fontSize: `${tamano}px` }}
        aria-label="Cifrado del canto"
      >
        {enBloques(lineas).map((bloque, b) => {
          if (bloque.estrofa < 0) return bloque.lineas.map((l, i) => pintarLinea(l, b * 1000 + i))

          const canta = quienCanta[bloque.estrofa] ?? null
          const atenuada = resaltar && atenuarParaMiCuerda(canta, herramientas?.miCuerda ?? null)
          // De solo lectura (2026-11-17): el marcado del director vive al pie
          // de la ficha; acá no se planifica encima del cifrado.
          const rotulo = verQuien && canta ? (
            <span className="font-bold">{nombreDeQuienCanta(canta)}</span>
          ) : null

          return (
            // La franja va en el margen de la página (los 16 px de `px-4`), no
            // dentro del cifrado: así no le quita columnas a la letra.
            <div
              key={b}
              className={`relative transition-opacity ${atenuada ? 'opacity-45' : ''}`}
            >
              {verQuien && canta && (
                <span
                  aria-hidden
                  className="absolute top-0.5 bottom-0.5 -left-2.5 w-[3px] rounded-full"
                  style={{ background: FRANJA[canta] }}
                />
              )}
              {rotulo && <div className="mb-1 font-interfaz text-sm text-texto-tenue">{rotulo}</div>}
              {bloque.lineas.map((l, i) => pintarLinea(l, b * 1000 + i))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
