import type { ReactNode } from 'react'
import Link from 'next/link'
import { renderizarCifrado, type LineaCifrado } from '@/lib/motores/renderizar-cifrado'
import {
  atenuarParaMiCuerda,
  huellaDeEstrofa,
  nombreDeQuienCanta,
  type QuienCanta,
} from '@/lib/motores/quien-canta'
import type { CuerdaDelCoro } from '@/lib/motores/cuerdas'
import MarcaEstrofa from './marca-estrofa'

/**
 * Pinta el cifrado con los acordes sobre la letra (H2, RF-17).
 *
 * No decide nada: solo dibuja lo que devolvió el motor. La posición de cada
 * acorde ya viene calculada y probada en `renderizar-cifrado.test.ts`.
 *
 * Dos cosas sostienen la alineación:
 *   1. Tipografía monoespaciada. En una proporcional esto no funcionaría.
 *   2. La línea de acordes se rellena con espacios hasta la columna que toca.
 *
 * Y el ajuste de línea: el cifrado se parte a `COLUMNAS` y la tipografía se
 * encoge según el ancho del contenedor, de modo que esas columnas SIEMPRE
 * entren sin scroll horizontal — ni en un teléfono de 360 px.
 */

/** Columnas de referencia, para el tamaño de letra de referencia (16 px). */
const COLUMNAS_BASE = 42
const TAMANO_BASE = 16

/**
 * Cuántos caracteres por línea, según el tamaño de letra pedido.
 *
 * Pedir letra más grande tiene que AGRANDAR la letra, no quedar en nada. Si las
 * columnas fueran fijas, en un teléfono angosto el ajuste al ancho recalcularía
 * la fuente hacia abajo y el botón A+ no haría nada visible. Con menos columnas
 * por línea, el verso se parte más seguido y la letra sí crece.
 */
function columnasPara(tamano: number): number {
  return Math.max(20, Math.round((COLUMNAS_BASE * TAMANO_BASE) / tamano))
}

/**
 * Ancho de un carácter, en fracción del tamaño de fuente.
 *
 * JetBrains Mono mide exactamente 0.6em (DESIGN.md · Typography); el 0.615 deja
 * un pelo de aire por si la fuente todavía no cargó y el navegador dibuja con
 * la mono de sistema, que puede ser un poco más ancha.
 */
const ANCHO_CARACTER = 0.615

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
  /** Solo el director, y solo con «Quién canta» prendida: marca las estrofas. */
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
  const columnas = columnasPara(tamano)
  const { lineas, quienCanta } = renderizarCifrado(cifrado, {
    ancho: columnas,
    mostrarAcordes,
    latina: herramientas?.latina,
  })

  const marcado = quienCanta.some(Boolean)
  const verQuien = !!herramientas?.quienCanta
  const resaltar = !!herramientas?.resaltarMiCuerda
  const marcar = verQuien ? herramientas?.marcar ?? null : null

  // Lo que la herramienta no puede hacer todavía, dicho en vez de callado.
  const avisos: ReactNode[] = []
  if (resaltar && !herramientas?.miCuerda) {
    avisos.push(
      <>
        Para resaltar tu cuerda, elige tu tesitura en{' '}
        <Link href="/mi-perfil" className="text-acento underline underline-offset-2">
          Mi perfil
        </Link>
        .
      </>
    )
  }
  if ((verQuien || resaltar) && !marcado) {
    avisos.push(
      marcar
        ? 'Elige quién canta cada estrofa en el rótulo que está sobre ella.'
        : 'Este canto todavía no tiene marcado quién canta cada estrofa.'
    )
  }

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
      <div key={i}>
        {linea.acordes.length > 0 && (
          <div className="whitespace-pre font-semibold text-acorde">
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
                    className="acorde-tocable"
                  >
                    {a.acorde}
                  </button>
                </span>
              )
            })}
          </div>
        )}
        <div className="whitespace-pre text-texto">{linea.texto || ' '}</div>
      </div>
    )
  }

  // El `container-type` va en el PADRE, no en el mismo elemento que usa `cqi`:
  // un contenedor no puede consultar su propio tamaño (sería un ciclo), y las
  // unidades se resolverían contra el viewport, que es más ancho.
  return (
    <div style={{ containerType: 'inline-size' }}>
      {avisos.length > 0 && (
        <div className="mb-4 space-y-1 text-sm text-texto-tenue">
          {avisos.map((a, i) => (
            <p key={i}>{a}</p>
          ))}
        </div>
      )}
      <div
        className="cifrado"
        style={{
          fontSize: `min(${tamano}px, calc(100cqi / ${(columnas * ANCHO_CARACTER).toFixed(2)}))`,
        }}
        aria-label="Cifrado del canto"
      >
        {enBloques(lineas).map((bloque, b) => {
          if (bloque.estrofa < 0) return bloque.lineas.map((l, i) => pintarLinea(l, b * 1000 + i))

          const canta = quienCanta[bloque.estrofa] ?? null
          const atenuada = resaltar && atenuarParaMiCuerda(canta, herramientas?.miCuerda ?? null)
          const rotulo = marcar ? (
            <MarcaEstrofa
              cantoId={marcar.cantoId}
              estrofa={bloque.estrofa}
              huella={huellaDeEstrofa(cifrado, bloque.estrofa) ?? ''}
              canta={canta}
            />
          ) : verQuien && canta ? (
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
