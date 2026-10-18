/**
 * Render del cifrado — H2, docs/PRD.md §9.
 *
 * Motor PURO: convierte ChordPro en líneas con la posición de cada acorde sobre
 * la letra. Sin base, sin red, sin reloj. La pantalla solo pinta lo que esto
 * devuelve, así que la regla de "dónde va cada acorde" se prueba sola.
 *
 * Se hace en el servidor a propósito (PRD decisión 4): la página llega pintada
 * al teléfono, que es donde la conexión es peor.
 */

export type AcordePosicionado = {
  acorde: string
  /**
   * H19-B · Ordinal del acorde en el canto entero (0, 1, 2…). Es lo que
   * identifica AL acorde que se tocó entre veinte `[G]` iguales: no cambia al
   * transponer ni con el ancho, y coincide con `ubicarAcordes`.
   */
  indice: number
  /** Columna en el texto de la letra: el dato real del cifrado. */
  columna: number
  /**
   * Dónde se dibuja para que dos acordes no se pisen. Coincide con `columna`
   * salvo que el anterior sea tan largo que invada este lugar.
   */
  columnaPintada: number
  /**
   * Con la herramienta «Acordes en Do-Re-Mi», `acorde` es el nombre en latina
   * (lo que se ve y lo que mide el anti-solape) y acá queda el americano, que
   * es el que buscan los diagramas. Sin la herramienta, no existe.
   */
  americano?: string
}

export type LineaCifrado = {
  texto: string
  acordes: AcordePosicionado[]
  /** Línea en blanco: separa estrofas y se conserva. */
  esSeparador: boolean
  /** Vino de un `{comment: ...}`: se muestra distinto. */
  esComentario: boolean
  /**
   * A qué estrofa pertenece (0, 1, 2…; −1 los separadores), contada como en
   * `estrofasDe`: los bloques de líneas del cifrado entre líneas en blanco.
   */
  estrofa: number
}

export type CifradoRenderizado = {
  lineas: LineaCifrado[]
  totalAcordes: number
  /** Quién canta cada estrofa (2026-10-17), por índice; null = sin marcar. */
  quienCanta: (QuienCanta | null)[]
}

/** Directivas que no se pintan: el título y el autor viven en sus columnas (RF-28). */
const METAETIQUETAS = /^\{\s*(title|t|subtitle|st|artist|composer|key|tempo|time)\s*:.*\}\s*$/i
const COMENTARIO = /^\{\s*(comment|c|ci|comment_italic)\s*:\s*(.*?)\s*\}\s*$/i

import { MARCA as MARCA_QUIEN_CANTA, estrofasDe, type QuienCanta } from './quien-canta'
import { americanaALatina } from './notacion-latina'

/** Un acorde entre corchetes: `[C]`, `[F#m]`, `[A9/C#]`, `[Bm/A]`. */
const ACORDE = /\[([^\]\n]+)\]/g

/**
 * H19-B · ¿Esta línea cruda pinta acordes? Las metaetiquetas no se pintan y un
 * `{comment:}` se pinta como texto: sus corchetes no son acordes tocables.
 *
 * Exportada para que `ubicarAcordes` cuente con LA MISMA regla: si contaran
 * distinto, el ordinal se desalinea y se corrige un acorde que no se tocó.
 */
export function lineaPintaAcordes(cruda: string): boolean {
  const t = cruda.trim()
  return !METAETIQUETAS.test(t) && !COMENTARIO.test(t) && !MARCA_QUIEN_CANTA.test(t)
}

function separarAcordes(
  linea: string,
  primerIndice: number,
  latina = false
): { texto: string; acordes: AcordePosicionado[] } {
  const acordes: AcordePosicionado[] = []
  let texto = ''
  let ultimoCorte = 0

  ACORDE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ACORDE.exec(linea)) !== null) {
    texto += linea.slice(ultimoCorte, m.index)
    acordes.push({
      acorde: latina ? americanaALatina(m[1]) : m[1],
      indice: primerIndice + acordes.length,
      columna: texto.length,
      columnaPintada: texto.length,
      ...(latina ? { americano: m[1] } : {}),
    })
    ultimoCorte = m.index + m[0].length
  }
  texto += linea.slice(ultimoCorte)

  // Segunda pasada: correr hacia la derecha los que se pisarían.
  // Pasa siempre con la semilla, donde los acordes van agrupados al inicio
  // porque el cancionero de origen no dice sobre qué sílaba cae cada uno.
  let libreDesde = 0
  for (const a of acordes) {
    a.columnaPintada = Math.max(a.columna, libreDesde)
    libreDesde = a.columnaPintada + a.acorde.length + 1 // +1 de aire
  }

  return { texto, acordes }
}

/**
 * Parte una línea que no cabe en `ancho` columnas, cortando en los espacios y
 * llevándose los acordes al trozo que les toca (RF-17: ajuste de línea al ancho
 * del dispositivo).
 *
 * Sin esto, en un teléfono de 360 px la letra se sale de la pantalla y hay que
 * arrastrar de lado para leer el final de cada verso — justo mientras se toca.
 */
function partirAlAncho(linea: LineaCifrado, ancho: number): LineaCifrado[] {
  if (linea.texto.length <= ancho) return [linea]

  const cortes: { desde: number; hasta: number }[] = []
  let desde = 0

  while (desde < linea.texto.length) {
    if (linea.texto.length - desde <= ancho) {
      cortes.push({ desde, hasta: linea.texto.length })
      break
    }
    // Último espacio dentro del ancho; si no hay ninguno (palabra larguísima),
    // se corta a lo bruto para no colgarse.
    const ventana = linea.texto.slice(desde, desde + ancho + 1)
    const espacio = ventana.lastIndexOf(' ')
    const hasta = espacio > 0 ? desde + espacio : desde + ancho
    cortes.push({ desde, hasta })
    desde = espacio > 0 ? hasta + 1 : hasta
  }

  return cortes.map((corte, i) => {
    const esUltimo = i === cortes.length - 1
    const acordes = linea.acordes
      .filter((a) => a.columna >= corte.desde && (a.columna < corte.hasta || esUltimo))
      .map((a) => ({
        ...a,
        columna: Math.max(0, a.columna - corte.desde),
        columnaPintada: Math.max(0, a.columna - corte.desde),
      }))

    // Recalcular el anti-solape dentro del trozo.
    let libreDesde = 0
    for (const a of acordes) {
      a.columnaPintada = Math.max(a.columna, libreDesde)
      libreDesde = a.columnaPintada + a.acorde.length + 1
    }

    return {
      texto: linea.texto.slice(corte.desde, corte.hasta),
      acordes,
      esSeparador: false,
      esComentario: linea.esComentario,
      estrofa: linea.estrofa,
    }
  })
}

/**
 * Los acordes que se dibujarían más allá del ancho bajan a una línea propia,
 * solo de acordes, en el mismo orden (2026-10-17).
 *
 * `partirAlAncho` corta por el largo de la LETRA. Pero una hoja de acordes puede
 * poner acordes después de la última sílaba («creador,[Csus4][C][F]» en
 * *Cantaré por siempre*): la letra cabía y los acordes se salían de la pantalla.
 * Bajan con su ordinal intacto, así que tocarlos y corregirlos (H19-B) sigue
 * apuntando al mismo `[F]` del cifrado.
 */
function bajarAcordesQueNoCaben(linea: LineaCifrado, ancho: number): LineaCifrado[] {
  const caben = linea.acordes.filter((a) => a.columnaPintada + a.acorde.length <= ancho)
  const bajan = linea.acordes.filter((a) => a.columnaPintada + a.acorde.length > ancho)
  if (bajan.length === 0) return [linea]
  // Un acorde más largo que el ancho entero no cabe en ninguna parte: se queda,
  // para no bajarlo para siempre.
  if (caben.length === 0 && linea.texto === '') return [linea]

  let libreDesde = 0
  const enFila = bajan.map((a) => {
    const columna = libreDesde
    libreDesde = columna + a.acorde.length + 1
    return { ...a, columna, columnaPintada: columna }
  })
  return [
    { ...linea, acordes: caben },
    ...bajarAcordesQueNoCaben(
      { texto: '', acordes: enFila, esSeparador: false, esComentario: linea.esComentario, estrofa: linea.estrofa },
      ancho
    ),
  ]
}

/**
 * @param opciones.mostrarAcordes  H11 · en `false` devuelve la letra sola.
 * @param opciones.latina  Herramienta «Acordes en Do-Re-Mi»: los nombres en latina.
 *
 * Los acordes se omiten ACÁ y no con CSS a propósito: escondidos con una clase
 * seguirían en el HTML, y quien lee con lector de pantalla —el mismo piso de
 * accesibilidad que pide la letra grande— los seguiría oyendo entre verso y
 * verso. Lo que no se muestra, no se manda.
 */
export function renderizarCifrado(
  cifrado: string,
  opciones: { ancho?: number; mostrarAcordes?: boolean; latina?: boolean } = {}
): CifradoRenderizado {
  if (cifrado.trim() === '') return { lineas: [], totalAcordes: 0, quienCanta: [] }

  const mostrarAcordes = opciones.mostrarAcordes ?? true

  const lineas: LineaCifrado[] = []
  // H19-B · El ordinal se cuenta sobre TODOS los acordes, también los que no se
  // muestran en modo solo letra, para que siga valiendo lo mismo en los dos.
  let siguienteIndice = 0
  // La estrofa de cada línea, contada sobre el cifrado CRUDO como en `estrofasDe`.
  let estrofa = -1
  let anteriorEnBlanco = true

  for (const cruda of cifrado.split('\n')) {
    const enBlanco = cruda.trim() === ''
    if (!enBlanco && anteriorEnBlanco) estrofa++
    anteriorEnBlanco = enBlanco
    // Las metaetiquetas y la marca de quién canta no se pintan.
    if (METAETIQUETAS.test(cruda.trim()) || MARCA_QUIEN_CANTA.test(cruda.trim())) continue

    const comentario = COMENTARIO.exec(cruda.trim())
    if (comentario) {
      lineas.push({
        texto: comentario[2],
        acordes: [],
        esSeparador: false,
        esComentario: true,
        estrofa,
      })
      continue
    }

    const { texto, acordes } = separarAcordes(cruda, siguienteIndice, opciones.latina)
    siguienteIndice += acordes.length

    // Una línea de solo acordes —la intro `[G][D]`, el puente— sin acordes no
    // dice nada. Se omite entera en vez de dejar un renglón vacío que abriría
    // un hueco en medio de la estrofa.
    if (!mostrarAcordes && texto.trim() === '' && acordes.length > 0) continue

    const linea: LineaCifrado = {
      texto,
      acordes: mostrarAcordes ? acordes : [],
      // El separador se decide con los acordes ORIGINALES: una línea en blanco
      // del cifrado separa estrofas en los dos modos.
      esSeparador: texto.trim() === '' && acordes.length === 0,
      esComentario: false,
      estrofa: enBlanco ? -1 : estrofa,
    }

    if (opciones.ancho && opciones.ancho > 0 && !linea.esSeparador) {
      const ancho = opciones.ancho
      lineas.push(...partirAlAncho(linea, ancho).flatMap((t) => bajarAcordesQueNoCaben(t, ancho)))
    } else {
      lineas.push(linea)
    }
  }

  return {
    lineas,
    totalAcordes: lineas.reduce((n, l) => n + l.acordes.length, 0),
    quienCanta: estrofasDe(cifrado).map((e) => e.canta),
  }
}
