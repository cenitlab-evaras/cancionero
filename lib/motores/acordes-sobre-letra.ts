import { latinaAAmericana } from './notacion-latina'

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
 */
const TOKEN_ACORDE =
  /^([A-G]|DO|RE|MI|FA|SOL|LA|SI)(#|b)?(m|maj|sus|dim|aug|add|M)?[0-9]*(\/([A-G]|DO|RE|MI|FA|SOL|LA|SI)(#|b)?)?$/i

/** ¿Esta línea es una línea de acordes y no de letra? */
function esLineaDeAcordes(linea: string): boolean {
  const tokens = linea.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return false
  // TODOS los tokens tienen que parecer acordes. Con "alguno" alcanzaría para
  // que «respiro la aurora» pasara por línea de acordes: en español «la» y
  // «mi» son palabras, no solo notas.
  return tokens.every((t) => TOKEN_ACORDE.test(t))
}

/** Los acordes de una línea, con la columna donde empieza cada uno. */
function acordesConColumna(linea: string): { acorde: string; columna: number }[] {
  const salida: { acorde: string; columna: number }[] = []
  const re = /\S+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(linea)) !== null) {
    salida.push({ acorde: m[0], columna: m.index })
  }
  return salida
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

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i]

    if (linea.trim() === '') {
      salida.push('')
      continue
    }

    if (!esLineaDeAcordes(linea)) {
      salida.push(linea)
      continue
    }

    const acordes = acordesConColumna(linea)
    const siguiente = lineas[i + 1]

    // Una línea de acordes sin letra debajo es un intro o un interludio: queda
    // como una línea de corchetes sueltos, que es como la escribe la semilla.
    if (siguiente === undefined || siguiente.trim() === '' || esLineaDeAcordes(siguiente)) {
      salida.push(acordes.map((a) => `[${a.acorde}]`).join(' '))
      continue
    }

    salida.push(fundir(acordes, siguiente))
    i++ // la línea de letra ya se consumió
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
