import { renderizarCifrado } from '@/lib/motores/renderizar-cifrado'

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

export default function Cifrado({ cifrado, tamano = 16 }: { cifrado: string; tamano?: number }) {
  const columnas = columnasPara(tamano)
  const { lineas } = renderizarCifrado(cifrado, { ancho: columnas })

  // El `container-type` va en el PADRE, no en el mismo elemento que usa `cqi`:
  // un contenedor no puede consultar su propio tamaño (sería un ciclo), y las
  // unidades se resolverían contra el viewport, que es más ancho.
  return (
    <div style={{ containerType: 'inline-size' }}>
      <div
        className="cifrado"
        style={{
          fontSize: `min(${tamano}px, calc(100cqi / ${(columnas * ANCHO_CARACTER).toFixed(2)}))`,
        }}
        aria-label="Cifrado del canto"
      >
      {lineas.map((linea, i) => {
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
                      <button type="button" data-acorde={a.acorde} className="acorde-tocable">
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
      })}
      </div>
    </div>
  )
}
