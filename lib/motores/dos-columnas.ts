/**
 * El cancionero impreso, que viene a dos columnas — H16, docs/PRD.md §17.
 *
 * Función PURA. Entra el texto de una página tal como lo devuelve
 * `pdftotext -layout`, sale el formato «acordes sobre letra» que
 * `desdeElCancionero` (H9) ya sabe convertir a ChordPro.
 *
 * POR QUÉ ESTE MOTOR Y NO UN PARSER DE PDF:
 *   §17.1 llamaba a esto «el motor más caro del alcance». Lo caro era leer el
 *   PDF; `pdftotext -layout` ya lo resuelve y deja las dos columnas alineadas.
 *   Lo único que faltaba era la pieza del medio, y son treinta líneas.
 *
 * LO QUE ESTA FUENTE NO DICE:
 *   El cancionero pone los acordes en una columna aparte, así que **no declara
 *   sobre qué sílaba cae cada uno**. Se reparten sobre los INICIOS DE PALABRA
 *   del verso, en orden y espaciados parejo.
 *
 *   Dejarlos amontonados al principio era la primera idea, y se probó: como
 *   `aChordPro` respeta la columna donde está cada acorde, «RE LA» al inicio
 *   producía `[D]Gra[A]nde es el cariño` — acordes metidos DENTRO de las
 *   palabras. Peor que estimar.
 *
 *   El reparto es una estimación y se declara como tal: la misma que §17.1 ya
 *   admite para los cantos curados a mano. El director la corrige desde
 *   «Editar» (H8), que existe justamente para eso.
 */

/** Una nota latina suelta, con su sufijo: SI7, fa#m, sol#m, (lam7), RE/LA. */
const ACORDE_LATINO =
  /^\(?(DO|RE|MI|FA|SOL|LA|SI|do|re|mi|fa|sol|la|si)[#b]?[a-zA-Z0-9()#/+°º-]*\)?$/

/** Todos los tokens tienen que parecer acordes, y tiene que haber al menos uno. */
export function esColumnaDeAcordes(texto: string): boolean {
  const tokens = texto.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return false
  return tokens.every((t) => ACORDE_LATINO.test(t))
}

/**
 * En qué columna empiezan los acordes, o `null` si la página no los tiene.
 *
 * Se busca la posición MÁS FRECUENTE, no la primera: una línea suelta puede
 * tener la letra más larga y correr su bloque de acordes, y fijarse en ella
 * partiría mal todas las demás.
 */
export function detectarColumnaDeAcordes(lineas: string[]): number | null {
  const votos = new Map<number, number>()

  for (const linea of lineas) {
    // El corte es el último salto de 2+ espacios cuya cola sean sólo acordes.
    for (const m of linea.matchAll(/ {2,}(?=\S)/g)) {
      const col = m.index! + m[0].length
      const cola = linea.slice(col)
      if (esColumnaDeAcordes(cola)) {
        votos.set(col, (votos.get(col) ?? 0) + 1)
      }
    }
  }
  if (votos.size === 0) return null

  // Empate: gana la columna más a la izquierda, que se traga menos letra.
  return [...votos.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]
}

/**
 * Una página de dos columnas → «acordes sobre letra».
 *
 * Cada línea con acordes produce DOS líneas: la de acordes y la de letra. Una
 * línea sin acordes (estrofa repetida) pasa sola, que es correcto: el cancionero
 * no los repite porque son los mismos.
 */
export function aAcordesSobreLetra(textoPagina: string): string {
  const lineas = textoPagina.split('\n')
  const col = detectarColumnaDeAcordes(lineas)
  if (col === null) return lineas.join('\n').trim()

  const salida: string[] = []
  for (const linea of lineas) {
    const letra = linea.slice(0, col).trimEnd()
    const acordes = linea.slice(col).trim()

    if (acordes && esColumnaDeAcordes(acordes)) {
      // Sin letra debajo es un intro o un interludio: la línea de acordes va sola.
      if (letra.trim()) salida.push(repartirSobreLetra(acordes, letra), letra)
      else salida.push(acordes)
    } else if (linea.trim()) {
      salida.push(linea.trimEnd())
    } else {
      salida.push('')
    }
  }
  return salida.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * `(SI7)` → `SI7`.
 *
 * El cancionero encierra entre paréntesis los acordes opcionales. El motor de
 * H9 no los reconoce como acorde, y una sola línea con paréntesis hacía que
 * `aChordPro` la descartara entera: el canto 1 salía con la mitad de sus
 * acordes sin convertir. Se pierde el matiz de «opcional» —que la app no sabe
 * representar— a cambio de que el canto se convierta.
 */
function sinParentesis(token: string): string {
  return token.replace(/^\(|\)$/g, '')
}

/**
 * La línea de acordes alineada sobre los inicios de palabra del verso.
 *
 * Los acordes se reparten parejo entre las palabras disponibles, en orden. Si
 * hay más acordes que palabras, los sobrantes se pegan al final separados por
 * un espacio, que es lo que hace el cancionero cuando cierra un verso con tres
 * acordes seguidos.
 */
export function repartirSobreLetra(acordes: string, letra: string): string {
  const tokens = acordes.trim().split(/\s+/).filter(Boolean).map(sinParentesis)
  if (tokens.length === 0) return ''

  // Dónde empieza cada palabra de la letra.
  const inicios: number[] = []
  for (const m of letra.matchAll(/\S+/g)) inicios.push(m.index!)
  if (inicios.length === 0) return tokens.join(' ')

  let linea = ''
  const paso = inicios.length / tokens.length

  tokens.forEach((acorde, i) => {
    const ideal = inicios[Math.min(Math.floor(i * paso), inicios.length - 1)]

    // Si el acorde anterior llega hasta la columna ideal, NO se empuja un
    // carácter —eso lo metía dentro de la palabra («una n[B]ueva»)—: se salta
    // al siguiente inicio de palabra que sí tenga lugar. Un acorde vale como
    // referencia sólo si el ojo lo puede asociar a una sílaba.
    const minimo = linea === '' ? 0 : linea.length + 1
    const col = inicios.find((x) => x >= Math.max(ideal, minimo)) ?? Math.max(ideal, minimo)

    linea += ' '.repeat(Math.max(col - linea.length, linea === '' ? 0 : 1)) + acorde
  })
  return linea
}

/** El encabezado `12. SEÑOR, TEN PIEDAD` de una página de canto. */
const TITULO = /^\s*(\d{1,3})\s*\.\s*(\S.*?)\s*$/

/**
 * El número y el título si la línea es un encabezado de canto.
 *
 * Se exige que el título tenga mayúsculas y NO termine en puntos de relleno:
 * el índice usa la misma forma `N. Título....` y colarlo cargaría 91 cantos
 * fantasma sin una sola línea de letra.
 */
export function tituloDeCanto(linea: string): { numero: number; titulo: string } | null {
  const m = TITULO.exec(linea)
  if (!m) return null

  const crudo = m[2]
  if (/\.{3,}\s*\d*\s*$/.test(crudo)) return null // fila del índice

  // Muchos títulos llevan un subtítulo entre paréntesis en minúscula —
  // «17. SALMO 4 (Me entregas calma)», «63. MAR ADENTRO (CD V CMP)»— y
  // exigirle versales a TODA la línea descartaba el canto entero: así se
  // perdían los seis salmos completos.
  const base = crudo.replace(/\s*\([^)]*\)\s*$/, '').trim()
  if (!base) return null
  if (base !== base.toLocaleUpperCase('es')) return null

  return { numero: Number(m[1]), titulo: normalizarTitulo(base) }
}

/**
 * `ABRE TU JARDÍN` → `Abre tu jardín`.
 *
 * El PDF titula en versales por diseño de la página, no porque el canto se
 * llame a los gritos. Las minúsculas de enlace se respetan («Tomad Señor y
 * recibid»), y se deja en mayúscula lo que ya venía siendo sigla de una letra.
 */
export function normalizarTitulo(versales: string): string {
  // Estilo oración, que es como se titula en castellano: la primera palabra y
  // los nombres propios. «Tomad Señor y recibid», no «Tomad Señor Y Recibid».
  const PROPIOS = new Set([
    'señor', 'dios', 'cristo', 'jesús', 'jesus', 'maría', 'maria', 'espíritu',
    'espiritu', 'padre', 'santo', 'maestro', 'samaritana', 'alfarero', 'aleluya',
    'gloria', 'salmo', 'himno', 'reina', 'virgen', 'carmen', 'betsaida',
  ])
  const enMayuscula = (p: string) => p.charAt(0).toLocaleUpperCase('es') + p.slice(1)

  let primera = true
  return versales
    .toLocaleLowerCase('es')
    .split(/(\s+)/)
    .map((palabra) => {
      if (/^\s*$/.test(palabra)) return palabra
      const limpia = palabra.replace(/[^\p{L}]/gu, '')
      const debe = primera || PROPIOS.has(limpia)
      primera = false
      return debe ? enMayuscula(palabra) : palabra
    })
    .join('')
}

// ---------------------------------------------------------------------------
// El índice del cancionero
//
// Es la única parte del PDF que dice a qué momento litúrgico pertenece cada
// canto: los encabezados de sección de las páginas («ENTRADA», «PERDÓN») están
// dibujados sobre las fotos, y no existen como texto.
//
// Además trae los títulos ya escritos como el editor los quiso —«Abre tu
// jardín», «Tomad Señor y recibid»— así que se prefieren a normalizar las
// versales de la página, que siempre es una adivinanza.
// ---------------------------------------------------------------------------

/** Las secciones del cancionero, en el código de momento que usa el producto. */
const SECCIONES: Record<string, string> = {
  entrada: 'entrada',
  perdon: 'perdon',
  perdón: 'perdon',
  gloria: 'gloria',
  salmos: 'salmo',
  salmo: 'salmo',
  antifonas: 'antifona',
  antífonas: 'antifona',
  ofertorio: 'ofertorio',
  santo: 'santo',
  cordero: 'cordero',
  comunion: 'comunion',
  comunión: 'comunion',
  maria: 'maria',
  maría: 'maria',
  himnos: 'himno',
  himno: 'himno',
}

export type EntradaDeIndice = { numero: number; titulo: string; momento: string }

/**
 * Dónde empieza la segunda columna del índice.
 *
 * NO se puede fijar: cada página del índice la pone en una posición distinta.
 * Con un corte fijo, «Cordero.....43       72. Tenemos…» quedaba partido como
 * «Cordero.....43       7» — el 7 de la columna de al lado — y la sección
 * dejaba de reconocerse, perdiendo los 40 cantos de esa página.
 *
 * Se vota la posición donde más veces arranca un bloque tras 3+ espacios.
 */
export function detectarCorteDeColumnas(lineas: string[]): number {
  const votos = new Map<number, number>()

  for (const linea of lineas) {
    for (const m of linea.matchAll(/ {3,}(?=\S)/g)) {
      const col = m.index! + m[0].length
      votos.set(col, (votos.get(col) ?? 0) + 1)
    }
  }
  if (votos.size === 0) return linea0Ancho

  // La más frecuente; a igual frecuencia, la más a la izquierda.
  return [...votos.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]
}

/** Sin columnas detectables, no se parte: todo es una sola columna. */
const linea0Ancho = Number.MAX_SAFE_INTEGER

/**
 * Lee el índice y devuelve, por número de canto, su título y su momento.
 *
 * El índice va a DOS COLUMNAS, así que no se puede leer de corrido: hay que
 * separarlas y recorrer primero la izquierda entera y después la derecha, o el
 * momento de cada canto sale mezclado con el de la otra mitad de la página.
 */
export function leerIndice(textoIndice: string, columnaDerechaDesde?: number): EntradaDeIndice[] {
  const lineas = textoIndice.split('\n')
  const corte = columnaDerechaDesde ?? detectarCorteDeColumnas(lineas)

  const izquierda: string[] = []
  const derecha: string[] = []

  for (const linea of lineas) {
    izquierda.push(linea.slice(0, corte))
    derecha.push(linea.slice(corte))
  }

  const salida: EntradaDeIndice[] = []
  let momento: string | null = null

  for (const linea of [...izquierda, ...derecha]) {
    const texto = linea.trim()
    if (!texto) continue

    // ¿Encabezado de sección? «Comunión..........46»
    const seccion = /^([A-Za-zÁÉÍÓÚÑáéíóúñ]+)\.{3,}\s*\d*\s*$/.exec(texto)
    if (seccion) {
      const codigo = SECCIONES[seccion[1].toLocaleLowerCase('es')]
      if (codigo) momento = codigo
      continue
    }

    // ¿Fila de canto? «17. Salmo 4 .......................»
    const fila = /^(\d{1,3})\.\s+(\S.*?)\s*\.{3,}\s*\d*\s*$/.exec(texto)
    if (fila && momento) {
      salida.push({ numero: Number(fila[1]), titulo: fila[2].trim(), momento })
    }
  }
  return salida
}
