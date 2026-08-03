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
  /** Columna en el texto de la letra: el dato real del cifrado. */
  columna: number
  /**
   * Dónde se dibuja para que dos acordes no se pisen. Coincide con `columna`
   * salvo que el anterior sea tan largo que invada este lugar.
   */
  columnaPintada: number
}

export type LineaCifrado = {
  texto: string
  acordes: AcordePosicionado[]
  /** Línea en blanco: separa estrofas y se conserva. */
  esSeparador: boolean
  /** Vino de un `{comment: ...}`: se muestra distinto. */
  esComentario: boolean
}

export type CifradoRenderizado = {
  lineas: LineaCifrado[]
  totalAcordes: number
}

/** Directivas que no se pintan: el título y el autor viven en sus columnas (RF-28). */
const METAETIQUETAS = /^\{\s*(title|t|subtitle|st|artist|composer|key|tempo|time)\s*:.*\}\s*$/i
const COMENTARIO = /^\{\s*(comment|c|ci|comment_italic)\s*:\s*(.*?)\s*\}\s*$/i

/** Un acorde entre corchetes: `[C]`, `[F#m]`, `[A9/C#]`, `[Bm/A]`. */
const ACORDE = /\[([^\]\n]+)\]/g

function separarAcordes(linea: string): { texto: string; acordes: AcordePosicionado[] } {
  const acordes: AcordePosicionado[] = []
  let texto = ''
  let ultimoCorte = 0

  ACORDE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = ACORDE.exec(linea)) !== null) {
    texto += linea.slice(ultimoCorte, m.index)
    acordes.push({ acorde: m[1], columna: texto.length, columnaPintada: texto.length })
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
        acorde: a.acorde,
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
    }
  })
}

export function renderizarCifrado(
  cifrado: string,
  opciones: { ancho?: number } = {}
): CifradoRenderizado {
  if (cifrado.trim() === '') return { lineas: [], totalAcordes: 0 }

  const lineas: LineaCifrado[] = []

  for (const cruda of cifrado.split('\n')) {
    if (METAETIQUETAS.test(cruda.trim())) continue

    const comentario = COMENTARIO.exec(cruda.trim())
    if (comentario) {
      lineas.push({
        texto: comentario[2],
        acordes: [],
        esSeparador: false,
        esComentario: true,
      })
      continue
    }

    const { texto, acordes } = separarAcordes(cruda)
    const linea: LineaCifrado = {
      texto,
      acordes,
      esSeparador: texto.trim() === '' && acordes.length === 0,
      esComentario: false,
    }

    if (opciones.ancho && opciones.ancho > 0 && !linea.esSeparador) {
      lineas.push(...partirAlAncho(linea, opciones.ancho))
    } else {
      lineas.push(linea)
    }
  }

  return {
    lineas,
    totalAcordes: lineas.reduce((n, l) => n + l.acordes.length, 0),
  }
}
