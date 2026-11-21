import { load, type CheerioAPI } from 'cheerio'
import { normalizarBusqueda } from './busqueda'

/**
 * Las lecturas de la misa — H30, docs/PRD.md §9.
 *
 * Motor PURO: sin base, sin red, sin reloj.
 *
 * Este archivo tiene dos entradas al mismo dominio: el pegado manual
 * (`repartirLecturas`) y la extracción del HTML de Iglesia.cl
 * (`extraerLecturasDeIglesia`), que comparten los tipos `ParteDeLectura` y
 * `TipoDeLectura`. La segunda es pura respecto de la red: recibe el HTML ya
 * descargado, para que el fetch viva en `lib/datos/`.
 *
 * `repartirLecturas` es el respaldo para cuando la importación no sirve: el
 * director pega el texto tal como lo copió y el motor lo abre en las partes que
 * conoce el lector. La regla que manda sobre las demás es que **nunca se
 * descarta texto**: lo que no se reconoce se conserva en la parte que le toca,
 * y si no hay ningún encabezado, todo queda en `primera` con
 * `reconocido: false` para que el director lo reparta a mano.
 */

/** Las cuatro partes, en el orden litúrgico en que se leen. */
export const PARTES = ['primera', 'salmo', 'segunda', 'evangelio'] as const
export type TipoDeLectura = (typeof PARTES)[number]

/** Los nombres que se ven en el lector y en el editor. */
export const NOMBRE_DE_PARTE: Record<TipoDeLectura, string> = {
  primera: 'Primera lectura',
  salmo: 'Salmo responsorial',
  segunda: 'Segunda lectura',
  evangelio: 'Evangelio',
}

export type ParteDeLectura = {
  tipo: TipoDeLectura
  /** La cita bíblica recortada («Isaías 55, 1-11»); puede quedar vacía. */
  referencia: string
  texto: string
}

export type RepartoDeLecturas = {
  /** Solo las partes encontradas, en el orden litúrgico de `PARTES`. */
  partes: ParteDeLectura[]
  /** `false` cuando no se reconoció ningún encabezado y todo quedó en `primera`. */
  reconocido: boolean
}

type Etiqueta = {
  tipo: TipoDeLectura
  palabras: readonly string[]
}

/**
 * Encabezados habituales. Se comparan ya normalizados (`normalizarBusqueda`:
 * sin mayúsculas ni tildes), así que «Primera Lectura» y «PRIMERA LECTURA» son
 * el mismo. Las etiquetas largas van antes que «aclamación» y «evangelio» para
 * que «Aclamación al Evangelio» no se lea solo como la primera palabra.
 *
 * La aclamación abre el Evangelio y el lector tiene una sola pestaña para los
 * dos: por eso comparte el tipo `evangelio` y sus bloques se juntan más abajo.
 */
const ETIQUETAS: readonly Etiqueta[] = [
  { tipo: 'primera', palabras: ['primera', 'lectura'] },
  { tipo: 'salmo', palabras: ['salmo', 'responsorial'] },
  { tipo: 'segunda', palabras: ['segunda', 'lectura'] },
  { tipo: 'evangelio', palabras: ['lectura', 'del', 'santo', 'evangelio'] },
  { tipo: 'evangelio', palabras: ['aclamacion', 'al', 'evangelio'] },
  { tipo: 'evangelio', palabras: ['aclamacion'] },
  { tipo: 'evangelio', palabras: ['evangelio'] },
]

/**
 * Palabras de la fórmula litúrgica que no son el nombre del libro. Se quitan
 * del comienzo de la referencia hasta dar con el libro: «Lectura del libro de
 * Isaías 55, 1-11» queda «Isaías 55, 1-11».
 */
const FORMULA_DE_LA_REFERENCIA = new Set([
  'lectura',
  'primera',
  'segunda',
  'tercera',
  'carta',
  'libro',
  'profecia',
  'profeta',
  'santo',
  'santa',
  'san',
  'apostol',
  'evangelio',
  'segun',
  'de',
  'del',
  'la',
  'las',
  'los',
  'el',
  'a',
  'pablo',
])

/** Un renglón en blanco no es contenido: no cuenta para nada. */
function enBlanco(linea: string): boolean {
  return linea.trim() === ''
}

/** Deja solo letras y números de un token, para comparar sin la puntuación. */
function sinPuntuacion(palabra: string): string {
  return palabra.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

/**
 * ¿Lo que sigue al encabezado en la misma línea puede ser la referencia?
 *
 * Es cita si trae capítulo y versículo («Isaías 55, 1-11»). También se acepta
 * la fórmula litúrgica sin números («según san Mateo», «del libro de Isaías»):
 * es la forma en la que el sitio a veces corta el renglón. Cualquier otra cosa
 * es prosa: la línea entera se trata como texto y no como encabezado.
 */
function pareceRestoDeReferencia(texto: string): boolean {
  const normalizado = normalizarBusqueda(texto)
  return /\d\s*,\s*\d/.test(normalizado) || /^(?:segun|del|de\s+la|de\s+los)\b/.test(normalizado)
}

/** Recorta la fórmula litúrgica y deja la cita: «Romanos 8, 35-39». */
function recortarReferencia(linea: string): string {
  const palabras = linea
    .trim()
    .split(/\s+/)
    .filter((palabra) => sinPuntuacion(palabra) !== '')

  let i = 0
  while (
    i < palabras.length &&
    FORMULA_DE_LA_REFERENCIA.has(normalizarBusqueda(sinPuntuacion(palabras[i])))
  ) {
    i++
  }

  return palabras
    .slice(i)
    .join(' ')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/[^\p{L}\p{N}]+$/u, '')
    .trim()
}

/**
 * ¿La línea siguiente al encabezado es la cita y no el comienzo del texto?
 *
 * Una cita trae capítulo y versículo («Isaías 55, 1-11», «144, 8-9») o arranca
 * con la fórmula «Lectura de…». El estribillo del salmo («R. El Señor es
 * compasivo…») no es cita, aunque a veces venga pegado al número del salmo.
 */
function esLineaDeReferencia(linea: string): boolean {
  const normalizado = normalizarBusqueda(linea)
  if (normalizado === '' || /^r[./]\s/.test(normalizado)) return false
  return (
    /\d\s*,\s*\d/.test(normalizado) ||
    /^lectura\s+(?:del|de\s+la|de\s+los|de)\b/.test(normalizado)
  )
}

/**
 * Lee un encabezado de parte. Devuelve `null` si la línea no lo es: en ese
 * caso se conserva tal cual dentro del texto.
 */
function leerEncabezado(linea: string): { tipo: TipoDeLectura; resto: string } | null {
  const palabras = linea.trim().split(/\s+/).filter(Boolean)
  if (palabras.length === 0) return null

  const comparables = palabras.map((palabra) => normalizarBusqueda(sinPuntuacion(palabra)))

  for (const etiqueta of ETIQUETAS) {
    if (!etiqueta.palabras.every((esperada, i) => comparables[i] === esperada)) continue

    const resto = palabras
      .slice(etiqueta.palabras.length)
      .filter((palabra) => sinPuntuacion(palabra) !== '')
      .join(' ')
      .trim()

    // Si después de la etiqueta sigue habiendo prosa, no era un encabezado.
    if (resto !== '' && !pareceRestoDeReferencia(resto)) return null

    return { tipo: etiqueta.tipo, resto }
  }

  return null
}

/** Índice del siguiente renglón con contenido, o -1 si no queda ninguno. */
function siguienteConTexto(lineas: string[], desde: number): number {
  for (let i = desde; i < lineas.length; i++) {
    if (!enBlanco(lineas[i])) return i
  }
  return -1
}

type Bloque = {
  tipo: TipoDeLectura
  referencia: string
  lineas: string[]
}

/**
 * Separa el texto pegado en las partes que reconoce.
 *
 * Los encabezados se buscan renglón por renglón. La referencia puede venir en
 * la misma línea del encabezado («SALMO RESPONSORIAL 144, 8-9») o en la
 * siguiente («PRIMERA LECTURA» y después «Lectura del libro de Isaías…»). Lo
 * que queda es el texto de la parte, con sus saltos de línea.
 *
 * Un texto sin encabezados no es un error: devuelve una sola parte `primera`
 * con todo y `reconocido: false`, para que el director lo reparta a mano.
 */
export function repartirLecturas(texto: string): RepartoDeLecturas {
  if (texto.trim() === '') return { partes: [], reconocido: false }

  const lineas = texto.split(/\r?\n/)
  const bloques: Bloque[] = []
  const previas: string[] = []
  let actual: Bloque | null = null

  for (let i = 0; i < lineas.length; i++) {
    const encabezado = leerEncabezado(lineas[i])

    if (!encabezado) {
      if (actual) actual.lineas.push(lineas[i])
      else previas.push(lineas[i])
      continue
    }

    actual = {
      tipo: encabezado.tipo,
      referencia: encabezado.resto === '' ? '' : recortarReferencia(encabezado.resto),
      lineas: [],
    }
    bloques.push(actual)

    // Encabezado sin cita en su línea: la cita puede ser el primer renglón con
    // contenido que sigue. Se lo lleva a `referencia` en vez de dejarlo como
    // comienzo del texto (el lector lo mostraría duplicado).
    if (actual.referencia === '') {
      const siguiente = siguienteConTexto(lineas, i + 1)
      if (
        siguiente !== -1 &&
        leerEncabezado(lineas[siguiente]) === null &&
        esLineaDeReferencia(lineas[siguiente])
      ) {
        actual.referencia = recortarReferencia(lineas[siguiente])
        i = siguiente
      }
    }
  }

  if (bloques.length === 0) {
    return {
      partes: [{ tipo: 'primera', referencia: '', texto: texto.trim() }],
      reconocido: false,
    }
  }

  // Nada de lo pegado antes del primer encabezado se tira: suele ser el título
  // o la fecha copiada junto con el texto, y se suma al primer bloque.
  if (previas.some((linea) => !enBlanco(linea))) {
    bloques[0].lineas.unshift(...previas)
  }

  const porTipo = new Map<TipoDeLectura, ParteDeLectura>()

  for (const bloque of bloques) {
    const parte: ParteDeLectura = {
      tipo: bloque.tipo,
      referencia: bloque.referencia,
      texto: bloque.lineas.join('\n').trim(),
    }

    const previa = porTipo.get(parte.tipo)
    if (!previa) {
      porTipo.set(parte.tipo, parte)
      continue
    }

    // Dos bloques del mismo tipo son una sola parte: la aclamación que abre el
    // Evangelio, o dos pegados seguidos. Se juntan sin perder el texto de
    // ninguno y se conserva la primera referencia que aparezca.
    if (parte.texto !== '') {
      previa.texto = previa.texto === '' ? parte.texto : `${previa.texto}\n${parte.texto}`
    }
    if (previa.referencia === '') previa.referencia = parte.referencia
  }

  const partes = [...porTipo.values()]
    .filter((parte) => parte.texto !== '' || parte.referencia !== '')
    .sort((a, b) => PARTES.indexOf(a.tipo) - PARTES.indexOf(b.tipo))

  return { partes, reconocido: true }
}

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
