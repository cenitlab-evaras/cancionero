import { normalizarBusqueda } from './busqueda'

/**
 * Las lecturas de la misa — H30, docs/PRD.md §9.
 *
 * Motor PURO: sin base, sin red, sin reloj.
 *
 * Este archivo tiene dos entradas al mismo dominio: el pegado manual (acá) y,
 * más adelante, la extracción del HTML de Iglesia.cl, que comparte los tipos
 * `ParteDeLectura` y `TipoDeLectura`.
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
