import { latinaAAmericana } from './notacion-latina.ts'

/**
 * "Acordes sobre letra" → ChordPro (H9 · RF-26 y RF-27 del funcional).
 *
 * Es como escribe el cancionero impreso y como escribe cualquier músico: los
 * acordes en una línea aparte, alineados sobre la sílaba donde caen.
 *
 *     C       G
 *     Gracias quiero      →    [C]Gracias [G]quiero
 *
 * El almacenamiento sigue siendo ChordPro y nada más (RF-27, decisión 4): esto
 * convierte lo que se pega en el editor, no cambia lo que vive en la base.
 *
 * Es el inverso exacto de `renderizarCifrado`, y su test de ida y vuelta lo
 * comprueba: si las columnas no coinciden después de convertir y renderizar, el
 * acorde quedó sobre otra sílaba y el músico toca mal.
 */

/**
 * Un token que puede ser un acorde, en americana o en latina.
 *
 * Se acepta la latina acá también porque el cancionero viene así y la
 * detección tiene que funcionar ANTES de traducir: si esta línea no se
 * reconoce como de acordes, no hay nada que traducir.
 *
 * Los sufijos son los del libro: `7+`, `m7`, `sus4`, `dim`, `°`… y el bajo con
 * barra (`RE/DO#`). Las letras sueltas solo valen como parte de un modificador
 * conocido: así «las» o «mis» (LA/MI + «s») siguen siendo letra.
 */
const TOKEN_ACORDE =
  /^([A-G]|DO|RE|MI|FA|SOL|LA|SI)(#|b)?([0-9#b+\-°ø()]|maj|min|sus|dim|aug|add|m|M)*(\/([A-G]|DO|RE|MI|FA|SOL|LA|SI)(#|b)?)?$/i

/** Anotaciones del libro que no son música: «1)», «2)», barras y dos puntos. */
const SE_IGNORA = /^(\d+\)|[|:/.()\-]+)$/

/** Los tokens de la línea ya limpios (sin paréntesis de adorno), o `null` si
 *  alguno no es un acorde. Las anotaciones y las barras se descartan. */
function tokensDeAcordes(linea: string): string[] | null {
  const crudos = linea.trim().split(/\s+/).filter(Boolean)
  const utiles: string[] = []
  for (const t of crudos) {
    if (SE_IGNORA.test(t)) continue
    // El libro encierra la intro entera entre paréntesis: «(SOL …» y «… RE)».
    const limpio = t.replace(/^\(+/, '').replace(/\)+$/, '')
    if (SE_IGNORA.test(limpio)) continue
    if (!TOKEN_ACORDE.test(limpio)) return null
    utiles.push(limpio)
  }
  return utiles.length > 0 ? utiles : null
}

/** ¿Esta línea es una línea de acordes y no de letra? */
function esLineaDeAcordes(linea: string): boolean {
  return tokensDeAcordes(linea) !== null
}

/** Los acordes de una línea ya limpia, con la columna donde empieza cada uno. */
function acordesConColumna(linea: string): { acorde: string; columna: number }[] {
  const salida: { acorde: string; columna: number }[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(linea)) !== null) {
    if (SE_IGNORA.test(m[0])) continue
    const limpio = m[0].replace(/^\(+/, '').replace(/\)+$/, '')
    if (SE_IGNORA.test(limpio)) continue
    salida.push({ acorde: limpio, columna: m.index })
  }
  return salida
}

/** ¿La línea trae anotaciones o barras? Sus columnas ya no son las del verso. */
function tieneIgnorados(linea: string): boolean {
  return linea
    .trim()
    .split(/\s+/)
    .some((t) => SE_IGNORA.test(t) || SE_IGNORA.test(t.replace(/^\(+/, '').replace(/\)+$/, '')))
}

/** Mete los acordes en la letra, en la columna que les toca. */
function fundir(acordes: { acorde: string; columna: number }[], letra: string): string {
  let salida = ''
  let cursor = 0

  for (const { acorde, columna } of acordes) {
    // Un acorde más allá del final de la letra se pega al final: pasa siempre
    // en el último acorde de una estrofa.
    const corte = Math.min(columna, letra.length)
    if (corte > cursor) salida += letra.slice(cursor, corte)
    salida += `[${acorde}]`
    cursor = Math.max(cursor, corte)
  }

  return salida + letra.slice(cursor)
}

export function aChordPro(texto: string): string {
  // Si ya es ChordPro, convertirlo lo destruiría.
  if (texto.includes('[')) return texto

  const lineas = texto.split('\n')
  const salida: string[] = []
  /** La línea anterior fue una línea de acordes sola: una intro no se funde. */
  let anteriorSoloAcordes = false

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i]

    if (linea.trim() === '') {
      salida.push('')
      anteriorSoloAcordes = false
      continue
    }

    if (!esLineaDeAcordes(linea)) {
      salida.push(linea)
      anteriorSoloAcordes = false
      continue
    }

    const acordes = acordesConColumna(linea)
    const siguiente = lineas[i + 1]
    const siguienteEsAcordes =
      siguiente !== undefined && siguiente.trim() !== '' && esLineaDeAcordes(siguiente)

    // Una línea de acordes sin letra debajo es un intro o un interludio: queda
    // como una línea de corchetes sueltos, que es como la escribe la semilla.
    // Si trae anotaciones («1)»), sus columnas no son las del verso y tampoco
    // se funde. Y la continuación de una intro no se funde nunca: el bloque de
    // acordes se lee entero y la letra arranca después.
    if (
      anteriorSoloAcordes ||
      tieneIgnorados(linea) ||
      siguiente === undefined ||
      siguiente.trim() === '' ||
      siguienteEsAcordes
    ) {
      salida.push(acordes.map((a) => `[${a.acorde}]`).join(' '))
      anteriorSoloAcordes = true
      continue
    }

    salida.push(fundir(acordes, siguiente))
    i++ // la línea de letra ya se consumió
    anteriorSoloAcordes = false
  }

  return salida.join('\n')
}

/**
 * ¿Este texto está escrito con los acordes en una línea aparte?
 *
 * Se usa para OFRECER la conversión, no para imponerla: el editor avisa y el
 * director decide. Convertir a la fuerza lo que alguien escribió a propósito
 * sería peor que no convertir nada.
 */
export function pareceAcordesSobreLetra(texto: string): boolean {
  if (texto.includes('[')) return false

  const lineas = texto.split('\n').filter((l) => l.trim() !== '')
  if (lineas.length < 2) return false

  const deAcordes = lineas.filter(esLineaDeAcordes).length
  // Al menos una línea de acordes, y no todas: si TODAS lo fueran, es una lista
  // de acordes y no un cifrado con letra.
  return deAcordes > 0 && deAcordes < lineas.length
}

/**
 * Lo que el director necesita: pegar del cancionero y que funcione.
 *
 * Compone los dos motores en el orden que importa —primero mover los acordes a
 * su columna, después traducir la notación— porque la detección de "línea de
 * acordes" tiene que reconocer la latina para poder actuar.
 *
 * Es idempotente: aplicarlo a un cifrado que ya está en ChordPro americano lo
 * devuelve intacto, así que el botón se puede tocar dos veces sin miedo.
 */
export function desdeElCancionero(texto: string): string {
  return aChordPro(texto).replace(
    /\[([^\]\n]+)\]/g,
    (_, acorde: string) => `[${latinaAAmericana(acorde)}]`
  )
}
