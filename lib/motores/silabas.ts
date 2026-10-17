/**
 * Silabeo en español — H19-B, docs/PRD.md §9.
 *
 * Motor PURO. Da las paradas de «moverlo de sílaba»: el acorde importado cae
 * donde lo estimó el conversor, y el director lo corre a la sílaba que de
 * verdad lleva el cambio — «can-[D]ción», no «canc[D]ión».
 *
 * Son las reglas de la escuela, no un diccionario: núcleos vocálicos con
 * diptongos e hiatos, y el reparto de las consonantes entre núcleos. Alcanza
 * para lo que se canta; una palabra rara que se parta distinto solo hace que
 * el director toque la flecha una vez más.
 */

/** Las vocales fuertes, y las débiles con tilde, que rompen el diptongo (Ma-rí-a). */
const FUERTES = new Set([...'aeoáéíóúAEOÁÉÍÓÚ'])
const VOCALES = new Set([...'aeiouáéíóúüAEIOUÁÉÍÓÚÜ'])

/** Pares de consonantes que nunca se separan: van juntos al inicio de la sílaba. */
const INSEPARABLES = new Set([
  'pr', 'br', 'tr', 'dr', 'cr', 'kr', 'gr', 'fr',
  'pl', 'bl', 'cl', 'kl', 'gl', 'fl',
])

/** Dígrafos: dos letras, un sonido, una consonante. */
const DIGRAFOS = new Set(['ch', 'll', 'rr'])

type Unidad = { desde: number; texto: string; vocal: boolean }

/** La y es vocal al final de palabra o antes de consonante (rey, hoy); antes de vocal, consonante (yo, reyes). */
function esVocal(palabra: string, i: number): boolean {
  const c = palabra[i]
  if (VOCALES.has(c)) return true
  if (c === 'y' || c === 'Y') {
    const siguiente = palabra[i + 1]
    return i > 0 && (siguiente === undefined || !VOCALES.has(siguiente))
  }
  return false
}

function unidades(palabra: string): Unidad[] {
  const salida: Unidad[] = []
  for (let i = 0; i < palabra.length; i++) {
    const par = palabra.slice(i, i + 2).toLowerCase()
    if (DIGRAFOS.has(par)) {
      salida.push({ desde: i, texto: palabra.slice(i, i + 2), vocal: false })
      i++
      continue
    }
    salida.push({ desde: i, texto: palabra[i], vocal: esVocal(palabra, i) })
  }
  return salida
}

function esFuerte(u: Unidad): boolean {
  return FUERTES.has(u.texto)
}

/**
 * Dónde empieza cada sílaba de UNA palabra, en índices de la palabra.
 * El primero es siempre 0.
 */
function cortes(palabra: string): number[] {
  const us = unidades(palabra)

  // Núcleos: tramos de vocales seguidas. Dos fuertes juntas son hiato y parten
  // el tramo; cualquier otra combinación es diptongo o triptongo y no.
  const nucleos: { primera: number; ultima: number }[] = []
  for (let i = 0; i < us.length; i++) {
    if (!us[i].vocal) continue
    const anterior = nucleos[nucleos.length - 1]
    const pegada = anterior && anterior.ultima === i - 1
    if (pegada && !(esFuerte(us[i - 1]) && esFuerte(us[i]))) {
      anterior.ultima = i
    } else {
      nucleos.push({ primera: i, ultima: i })
    }
  }

  if (nucleos.length <= 1) return [0]

  const inicios = [0]
  for (let k = 1; k < nucleos.length; k++) {
    const desde = nucleos[k - 1].ultima + 1
    const hasta = nucleos[k].primera // exclusivo
    const consonantes = us.slice(desde, hasta)
    const n = consonantes.length

    // Cuántas de esas consonantes se lleva la sílaba siguiente.
    let alSiguiente: number
    if (n === 0) alSiguiente = 0
    else if (n === 1) alSiguiente = 1
    else {
      const ultimas = (consonantes[n - 2].texto + consonantes[n - 1].texto).toLowerCase()
      alSiguiente = INSEPARABLES.has(ultimas) ? 2 : 1
      // Con dos consonantes separables va una a cada lado (can-ción); con tres
      // o más, el grupo final inseparable se va entero (hom-bre, cons-truir) y
      // si no lo es se va solo la última (ins-tan-te).
    }

    inicios.push(us[hasta - alSiguiente].desde)
  }

  return inicios
}

/** Las sílabas de una palabra: `canción` → `['can', 'ción']`. Juntas vuelven a dar la palabra. */
export function silabear(palabra: string): string[] {
  if (palabra === '') return []
  const cs = cortes(palabra)
  return cs.map((desde, i) => palabra.slice(desde, cs[i + 1] ?? palabra.length))
}

/**
 * Las columnas donde empieza cada sílaba de una línea de letra.
 *
 * Son columnas del TEXTO —el mismo que calcula `renderizarCifrado` al quitar
 * los corchetes—, así que una parada cae exactamente bajo el carácter que se
 * ve. La puntuación y los espacios no son paradas.
 */
export function iniciosDeSilaba(texto: string): number[] {
  const salida: number[] = []
  for (const m of texto.matchAll(/\p{L}+/gu)) {
    for (const c of cortes(m[0])) salida.push(m.index + c)
  }
  return salida
}
