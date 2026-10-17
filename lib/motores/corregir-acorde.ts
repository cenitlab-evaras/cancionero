import { latinaAAmericana } from './notacion-latina.ts'
import { lineaPintaAcordes } from './renderizar-cifrado.ts'
import { iniciosDeSilaba } from './silabas.ts'

/**
 * Corregir el acorde en el lugar — H19-B, docs/PRD.md §9.
 *
 * Motor PURO. El director toca UN acorde en la vista de lectura y lo cambia,
 * lo borra, lo corre de sílaba o le agrega uno al lado. Esto decide cómo queda
 * el ChordPro; la action solo lo guarda, y el trigger de H19-A deja el rastro.
 *
 * Tres decisiones que conviene leer antes de tocarlo:
 *
 *   1. **El acorde se identifica por su ORDINAL** en el canto, no por su nombre
 *      ni por su posición en pantalla. El ordinal no cambia al transponer
 *      (transponer reemplaza nombres, no agrega ni quita corchetes) ni con el
 *      ancho del teléfono, y cuenta con la misma regla que `renderizarCifrado`
 *      (`lineaPintaAcordes`) — su test lo afirma.
 *   2. **Se reconstruye solo la línea tocada**, a partir de su letra y de sus
 *      acordes con columna. Las demás líneas no se rearman: quedan idénticas
 *      byte por byte, y el diff del historial muestra una sola línea.
 *   3. **Los nombres entran en el tono que se le pasa.** Este motor no sabe de
 *      transposición: la action le baja el nombre al tono guardado antes de
 *      llamarlo, con `transponerAcorde(nombre, -n)`.
 */

export type AcordeUbicado = {
  /** Ordinal en el canto entero. */
  indice: number
  acorde: string
  /** Línea del cifrado crudo (0 = la primera, cuenten o no las metaetiquetas). */
  linea: number
  /** Columna en la letra de esa línea, sin los corchetes. */
  columna: number
}

export type Correccion =
  /** Cambiar el nombre, moverlo `pasos` sílabas (negativo = a la izquierda), o las dos cosas. */
  | { tipo: 'cambiar'; indice: number; acorde: string; pasos: number }
  | { tipo: 'borrar'; indice: number }
  /** Uno nuevo en la sílaba que sigue a `despuesDe`, corrido `pasos` desde ahí. */
  | { tipo: 'agregar'; despuesDe: number; acorde: string; pasos: number }

export type ResultadoCorreccion =
  | {
      ok: true
      cifrado: string
      /** Dónde quedó el acorde corregido o agregado; `null` si se borró. */
      indice: number | null
      /** La línea cruda tocada, antes y después: es lo que se muestra antes de guardar. */
      lineaAntes: string
      lineaDespues: string
    }
  | { ok: false; error: string }

/** Un acorde entre corchetes, el mismo patrón que `renderizarCifrado`. */
const ACORDE = /\[([^\]\n]+)\]/g

/**
 * Un acorde americano: raíz, alteración, sufijos conocidos y bajo opcional.
 * Lo bastante cerrado para que una palabra («hola», «LA» latino) no pase.
 */
const AMERICANO =
  /^[A-G](#|b)?(maj|min|dim|aug|sus|add|m|M|\d+|[+\-º°ø()#b])*(\/[A-G](#|b)?)?$/

type AcordeEnLinea = { acorde: string; columna: number; orden: number }

function partirLinea(cruda: string): { texto: string; acordes: AcordeEnLinea[] } {
  const acordes: AcordeEnLinea[] = []
  let texto = ''
  let corte = 0
  for (const m of cruda.matchAll(ACORDE)) {
    texto += cruda.slice(corte, m.index)
    acordes.push({ acorde: m[1], columna: texto.length, orden: acordes.length })
    corte = m.index + m[0].length
  }
  return { texto: texto + cruda.slice(corte), acordes }
}

/** El inverso de `partirLinea`: con los mismos acordes devuelve la misma línea. */
function armarLinea(texto: string, acordes: AcordeEnLinea[]): string {
  let salida = ''
  let cursor = 0
  for (const a of acordes) {
    salida += texto.slice(cursor, a.columna) + `[${a.acorde}]`
    cursor = a.columna
  }
  return salida + texto.slice(cursor)
}

/**
 * Las paradas de una línea: el inicio de cada sílaba y el final de la última
 * palabra —donde cae el acorde que cierra la frase—. Una línea sin letra no
 * tiene ninguna: en una intro `[G] [D]` no hay sílaba a la que moverse.
 */
function paradas(texto: string): number[] {
  const inicios = iniciosDeSilaba(texto)
  if (inicios.length === 0) return []
  const fin = texto.trimEnd().length
  return fin > inicios[inicios.length - 1] ? [...inicios, fin] : inicios
}

/** La columna a `pasos` paradas de `desde`, o `null` si se sale de la línea. */
function columnaTras(texto: string, desde: number, pasos: number): number | null {
  if (pasos === 0) return desde
  const ps = paradas(texto)
  if (pasos > 0) {
    const derecha = ps.filter((p) => p > desde)
    return derecha[pasos - 1] ?? null
  }
  const izquierda = ps.filter((p) => p < desde).reverse()
  return izquierda[-pasos - 1] ?? null
}

export function ubicarAcordes(cifrado: string): AcordeUbicado[] {
  const salida: AcordeUbicado[] = []
  cifrado.split('\n').forEach((cruda, linea) => {
    if (!lineaPintaAcordes(cruda)) return
    for (const a of partirLinea(cruda).acordes) {
      salida.push({ indice: salida.length, acorde: a.acorde, linea, columna: a.columna })
    }
  })
  return salida
}

/**
 * Lo que escribió el director, como acorde americano; `null` si no es un acorde.
 * Acepta la latina (`RE`, `MIm7`) porque es como escribe el coro (H9).
 */
export function normalizarAcorde(entrada: string): string | null {
  const limpio = entrada.trim()
  if (limpio === '') return null
  if (AMERICANO.test(limpio)) return limpio
  const traducido = latinaAAmericana(limpio)
  return AMERICANO.test(traducido) ? traducido : null
}

/**
 * Cuántas sílabas se puede correr el acorde hacia cada lado sin salir de su
 * línea. Con `nuevo`, se cuenta para el que se agregaría después de `indice`,
 * desde la sílaba donde nace.
 */
export function pasosPosibles(
  cifrado: string,
  indice: number,
  opciones: { nuevo?: boolean } = {}
): { izquierda: number; derecha: number } {
  const u = ubicarAcordes(cifrado)[indice]
  if (!u) return { izquierda: 0, derecha: 0 }
  const texto = partirLinea(cifrado.split('\n')[u.linea]).texto
  const desde = opciones.nuevo ? (columnaTras(texto, u.columna, 1) ?? u.columna) : u.columna
  const ps = paradas(texto)
  return {
    izquierda: ps.filter((p) => p < desde).length,
    derecha: ps.filter((p) => p > desde).length,
  }
}

export function aplicarCorreccion(cifrado: string, c: Correccion): ResultadoCorreccion {
  const ubicados = ubicarAcordes(cifrado)
  const ref = ubicados[c.tipo === 'agregar' ? c.despuesDe : c.indice]
  if (!ref) return { ok: false, error: 'Ese acorde ya no está en el canto. Recárgalo.' }

  const lineas = cifrado.split('\n')
  const lineaAntes = lineas[ref.linea]
  // Un `\r` final (cifrado pegado desde Windows) no es letra: se aparta y se repone.
  const cr = lineaAntes.endsWith('\r') ? '\r' : ''
  const { texto, acordes } = partirLinea(cr ? lineaAntes.slice(0, -1) : lineaAntes)
  const primeroDeLaLinea = ubicados.findIndex((u) => u.linea === ref.linea)
  const enLinea = ref.indice - primeroDeLaLinea

  let nuevos: AcordeEnLinea[]
  let movido: AcordeEnLinea | null = null

  if (c.tipo === 'borrar') {
    nuevos = acordes.filter((_, i) => i !== enLinea)
  } else {
    const nombre = normalizarAcorde(c.acorde)
    if (nombre === null) return { ok: false, error: `«${c.acorde.trim()}» no es un acorde.` }

    let destino: number | null
    let orden: number
    if (c.tipo === 'cambiar') {
      destino = columnaTras(texto, ref.columna, c.pasos)
      orden = enLinea
      if (destino !== null && destino === ref.columna && nombre === ref.acorde) {
        return { ok: false, error: 'El acorde no cambió.' }
      }
    } else {
      // El nuevo nace en la sílaba siguiente; si no hay, junto al de referencia.
      const base = columnaTras(texto, ref.columna, 1) ?? ref.columna
      destino = columnaTras(texto, base, c.pasos)
      orden = enLinea + 0.5
    }
    if (destino === null) return { ok: false, error: 'No hay más sílabas hacia ese lado.' }

    movido = { acorde: nombre, columna: destino, orden }
    const resto = c.tipo === 'cambiar' ? acordes.filter((_, i) => i !== enLinea) : acordes
    // Va después de los que quedan a su izquierda y, en su misma columna,
    // conserva el orden que tenía con ellos: `[E][A]` no se invierte a `[A][E]`.
    const k = resto.filter(
      (a) => a.columna < destino || (a.columna === destino && a.orden < orden)
    ).length
    nuevos = [...resto.slice(0, k), movido, ...resto.slice(k)]
  }

  const lineaDespues = armarLinea(texto, nuevos) + cr
  lineas[ref.linea] = lineaDespues

  return {
    ok: true,
    cifrado: lineas.join('\n'),
    indice: movido ? primeroDeLaLinea + nuevos.indexOf(movido) : null,
    lineaAntes,
    lineaDespues,
  }
}
