import { load, type CheerioAPI } from 'cheerio'
import { normalizarBusqueda } from './busqueda'
import {
  PARTES,
  recortarReferencia,
  sinPuntuacion,
  type ParteDeLectura,
  type TipoDeLectura,
} from './lecturas'

/**
 * Extracción de las lecturas de la página pública de Eucaristía Diaria
 * (Iglesia.cl) — H30, docs/PRD.md §9.
 *
 * Vive aparte de `lecturas.ts` porque depende de cheerio: así el motor del
 * pegado manual y lo que importa la UI cliente quedan libres del parser. Sigue
 * siendo un motor puro: recibe el HTML ya descargado, sin red, base ni reloj;
 * el fetch vive en `lib/datos/`.
 *
 * Solo cubre la forma ordinaria. Los días con varios formularios, secuencia o
 * más de dos lecturas se devuelven como `complejo` y no se importan.
 */

/**
 * Lecturas extraídas de la página de Eucaristía Diaria (Iglesia.cl).
 *
 * `complejo` avisa que el día trae más de un formulario, una secuencia o más de
 * dos lecturas en la liturgia de la palabra: la importación no adivina y el
 * director pega a mano. En ese caso `partes` va vacío.
 */
export type ExtraccionDeLecturas = {
  partes: ParteDeLectura[]
  fecha: string | null
  complejo: boolean
}

/** Meses de la línea de fecha, sin tildes y en minúsculas. */
const MESES: Record<string, string> = {
  enero: '01',
  febrero: '02',
  marzo: '03',
  abril: '04',
  mayo: '05',
  junio: '06',
  julio: '07',
  agosto: '08',
  septiembre: '09',
  setiembre: '09',
  octubre: '10',
  noviembre: '11',
  diciembre: '12',
}

/** Los rótulos que abren un formulario distinto en los días complejos. */
const FORMULARIOS = ['Misa vespertina', 'Misa de la Noche', 'Misa del Día'] as const

/** El texto visible de un nodo, sin `&nbsp;` ni espacios de más. */
function limpiarTexto(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim()
}

/** La fecha de la línea «Eucaristía del … de … de AAAA», en ISO. */
function fechaDeLaPagina(texto: string): string | null {
  const coincidencia =
    /Eucarist[ií]a del [^\d]{0,60}?(\d{1,2})\s+de\s+([a-záéíóúüñ]+)\s+de\s+(\d{4})/i.exec(texto)
  if (!coincidencia) return null

  const dia = Number(coincidencia[1])
  const mes = MESES[normalizarBusqueda(coincidencia[2])]
  if (mes === undefined || dia < 1 || dia > 31) return null

  return `${coincidencia[3]}-${mes}-${String(dia).padStart(2, '0')}`
}

type Parrafo = {
  texto: string
  /** El párrafo entero es un tema en cursiva: ni es encabezado ni es texto. */
  tema: boolean
}

type Bloque = {
  tipo: TipoDeLectura
  referencia: string
  lineas: string[]
}

type Secciones = {
  liturgia: Parrafo[]
  evangelio: Parrafo[]
  tieneLiturgia: boolean
  tieneEvangelio: boolean
  textoCompleto: string
}

/**
 * Recorre los anclajes y los párrafos en orden documental. Cada párrafo queda
 * en la sección que abrió el último anclaje; lo que viene después de
 * `eucaristia` ya no es lectura.
 */
function leerSecciones($: CheerioAPI): Secciones {
  const liturgia: Parrafo[] = []
  const evangelio: Parrafo[] = []
  let actual: 'liturgia' | 'evangelio' | null = null
  let tieneLiturgia = false
  let tieneEvangelio = false

  $('a[name], p').each((_, nodo) => {
    const $nodo = $(nodo)

    if ($nodo.is('a')) {
      const nombre = limpiarTexto($nodo.attr('name') ?? '').toLowerCase()
      if (nombre === 'liturgia') {
        actual = 'liturgia'
        tieneLiturgia = true
      } else if (nombre === 'evangelio') {
        actual = 'evangelio'
        tieneEvangelio = true
      } else if (nombre === 'eucaristia' || nombre === 'inicio') {
        actual = null
      }
      return
    }

    if (actual === null) return

    const texto = limpiarTexto($nodo.text())
    if (texto === '') return

    // Los temas del sitio vienen enteros en cursiva y no se leen en voz alta.
    const textoEnCursiva = limpiarTexto($nodo.find('em').text())
    const parrafo: Parrafo = { texto, tema: textoEnCursiva === texto }

    if (actual === 'liturgia') liturgia.push(parrafo)
    else evangelio.push(parrafo)
  })

  return {
    liturgia,
    evangelio,
    tieneLiturgia,
    tieneEvangelio,
    textoCompleto: limpiarTexto($('body').text()),
  }
}

/** «Lectura de la profecía…» y «Lectura del libro…» abren una lectura. */
function esLecturaDe(texto: string): boolean {
  return /^lectura\s+(?:de|del)\b/.test(normalizarBusqueda(texto))
}

function esSalmo(texto: string): boolean {
  return /^salmo\s+responsorial\b/.test(normalizarBusqueda(texto))
}

function esSecuencia(texto: string): boolean {
  return /^secuencia\b/.test(normalizarBusqueda(texto))
}

/**
 * Los días con varios formularios, con secuencia o con más de dos lecturas no
 * se importan: el extractor no puede saber cuál de las formas es la del coro.
 */
function esCompleja(secciones: Secciones): boolean {
  const formularios = FORMULARIOS.filter((marca) => secciones.textoCompleto.includes(marca))
  if (formularios.length > 1) return true

  if (secciones.liturgia.some((parrafo) => esSecuencia(parrafo.texto))) return true

  const lecturas = secciones.liturgia.filter(
    (parrafo) => !parrafo.tema && esLecturaDe(parrafo.texto),
  ).length
  return lecturas > 2
}

/** Recorta «SALMO RESPONSORIAL» y deja la cita del salmo. */
function recortarReferenciaDeSalmo(texto: string): string {
  return recortarReferencia(texto.replace(/^salmo\s+responsorial\s*/i, ''))
}

/** Recorta la fórmula del Evangelio y deja «Mateo 14, 13-21». */
function recortarReferenciaDeEvangelio(texto: string): string {
  const palabras = texto.trim().split(/\s+/)
  const segun = palabras.findIndex(
    (palabra) => normalizarBusqueda(sinPuntuacion(palabra)) === 'segun',
  )
  return recortarReferencia(segun === -1 ? texto : palabras.slice(segun + 1).join(' '))
}

/** La línea de la cita del Evangelio (la del «+»), no la aclamación. */
function esReferenciaDeEvangelio(texto: string): boolean {
  const normalizado = normalizarBusqueda(texto).replace(/^[^\p{L}\p{N}]+/u, '')
  return (
    /^evangelio de nuestro se[ñn]or jesucristo\b/.test(normalizado) ||
    normalizado.startsWith('lectura del santo evangelio')
  )
}

/** Después del Evangelio vienen el Credo y la oración de los fieles. */
function cierraElEvangelio(texto: string): boolean {
  return /^(?:credo|se dice credo|oracion universal|plegaria universal)\b/.test(
    normalizarBusqueda(texto),
  )
}

/** Arma las partes de la liturgia de la palabra con sus referencias. */
function partesDeLaLiturgia(parrafos: Parrafo[]): ParteDeLectura[] {
  const bloques: Bloque[] = []
  let lecturas = 0
  let actual: Bloque | null = null

  for (const parrafo of parrafos) {
    if (parrafo.tema) continue

    if (esSalmo(parrafo.texto)) {
      actual = { tipo: 'salmo', referencia: recortarReferenciaDeSalmo(parrafo.texto), lineas: [] }
      bloques.push(actual)
      continue
    }

    if (esLecturaDe(parrafo.texto)) {
      lecturas++
      actual = {
        tipo: lecturas === 1 ? 'primera' : 'segunda',
        referencia: recortarReferencia(parrafo.texto),
        lineas: [],
      }
      bloques.push(actual)
      continue
    }

    if (actual) actual.lineas.push(parrafo.texto)
  }

  return bloques
    .map((bloque) => ({
      tipo: bloque.tipo,
      referencia: bloque.referencia,
      texto: bloque.lineas.join('\n'),
    }))
    .filter((parte) => parte.texto !== '' || parte.referencia !== '')
}

/**
 * Junta la aclamación y el Evangelio en una sola parte. El Credo y la oración
 * de los fieles, que el sitio publica en la misma sección, no son Evangelio.
 */
function parteDelEvangelio(parrafos: Parrafo[]): ParteDeLectura | null {
  const lineas: string[] = []
  let referencia = ''

  for (const parrafo of parrafos) {
    if (parrafo.tema) continue

    if (esReferenciaDeEvangelio(parrafo.texto)) {
      if (referencia === '') referencia = recortarReferenciaDeEvangelio(parrafo.texto)
      continue
    }

    if (cierraElEvangelio(parrafo.texto)) break

    lineas.push(parrafo.texto)
  }

  const texto = lineas.join('\n')
  if (texto === '' && referencia === '') return null
  return { tipo: 'evangelio', referencia, texto }
}

/**
 * Extrae las lecturas de la página pública de Eucaristía Diaria.
 *
 * Solo cubre la forma ordinaria. Si el día trae varios formularios, una
 * secuencia o más de dos lecturas, devuelve `complejo: true` y ninguna parte;
 * lo mismo si falta alguno de los anclajes, para no inventar lecturas a partir
 * de una página incompleta.
 */
export function extraerLecturasDeIglesia(html: string): ExtraccionDeLecturas {
  const $ = load(html)
  const fecha = fechaDeLaPagina(limpiarTexto($('body').text()))
  const secciones = leerSecciones($)

  if (esCompleja(secciones)) return { partes: [], fecha, complejo: true }

  if (!secciones.tieneLiturgia || !secciones.tieneEvangelio) {
    return { partes: [], fecha, complejo: false }
  }

  const partes = partesDeLaLiturgia(secciones.liturgia)
  const evangelio = parteDelEvangelio(secciones.evangelio)
  if (evangelio) partes.push(evangelio)

  partes.sort((a, b) => PARTES.indexOf(a.tipo) - PARTES.indexOf(b.tipo))
  return { partes, fecha, complejo: false }
}
