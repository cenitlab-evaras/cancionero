import { execFileSync } from 'node:child_process'
import {
  aAcordesSobreLetra,
  leerIndice,
  normalizarTitulo,
  tituloDeCanto,
  type EntradaDeIndice,
} from '../../lib/motores/dos-columnas.ts'
import { desdeElCancionero } from '../../lib/motores/acordes-sobre-letra.ts'

/**
 * Lee el cancionero impreso y devuelve los cantos listos para guardar — H16.
 *
 * La lectura del PDF la hace `pdftotext -layout` (poppler), que ya deja las dos
 * columnas alineadas. Todo lo demás son los motores puros, que se prueban solos.
 */

export type CantoDelCancionero = {
  numero: number
  titulo: string
  momento: string | null
  pagina: number
  cifrado: string
  /** Para el informe: qué se pudo y qué no. */
  problema?: string
}

function paginas(pdf: string): string[] {
  // `-layout` conserva las columnas; `\f` separa páginas.
  const texto = execFileSync('pdftotext', ['-layout', pdf, '-'], {
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  })
  return texto.split('\f')
}

export function leerCancionero(pdf: string): {
  cantos: CantoDelCancionero[]
  indice: EntradaDeIndice[]
} {
  const hojas = paginas(pdf)

  // El índice vive en las primeras páginas: se leen todas y se juntan.
  const indice = hojas.slice(0, 6).flatMap((h) => leerIndice(h))
  const porNumero = new Map(indice.map((e) => [e.numero, e]))

  const cantos: CantoDelCancionero[] = []

  hojas.forEach((hoja, i) => {
    const lineas = hoja.split('\n')

    // Una página puede traer DOS cantos: hay que cortarla por cada encabezado,
    // no quedarse con el primero. Leyendo sólo el primero se perdían 24 de 89.
    const cortes: { numero: number; titulo: string; desde: number }[] = []
    lineas.forEach((linea, n) => {
      const t = tituloDeCanto(linea)
      if (t) cortes.push({ ...t, desde: n + 1 })
    })
    if (cortes.length === 0) return

    cortes.forEach((corte, k) => {
      const hasta = cortes[k + 1]?.desde ? cortes[k + 1].desde - 1 : lineas.length
      const cuerpo = lineas.slice(corte.desde, hasta).join('\n')
      const cifrado = desdeElCancionero(aAcordesSobreLetra(cuerpo))
      const delIndice = porNumero.get(corte.numero)

      cantos.push({
        numero: corte.numero,
        // El índice trae el título como lo quiso el editor; las versales de la
        // página son el respaldo.
        titulo: delIndice?.titulo ?? normalizarTitulo(corte.titulo),
        momento: delIndice?.momento ?? null,
        pagina: i + 1,
        cifrado,
        problema: !delIndice
          ? 'no figura en el índice: sin momento litúrgico'
          : !/\[[A-G]/.test(cifrado)
            ? 'no se reconoció ningún acorde'
            : undefined,
      })
    })
  })

  // Un canto que el índice no cataloga hereda el momento del anterior: el
  // cancionero está ordenado por momento, así que el vecino de arriba acierta.
  // Es una estimación y se marca como tal, para que se pueda revisar después.
  cantos.sort((a, b) => a.numero - b.numero)
  let ultimo: string | null = null
  for (const c of cantos) {
    if (c.momento) ultimo = c.momento
    else if (ultimo) {
      c.momento = ultimo
      c.problema = `momento heredado del canto anterior (${ultimo}): no figura en el índice`
    }
  }

  return { cantos, indice }
}
