/**
 * H28 · El tono elegido, llevado a la partitura y a las pistas de «Ensayar».
 *
 * Motor PURO: sin base, sin red, sin reloj.
 *
 * El tono de una persona (o el que fijó el director para la misa, H27) se
 * guarda en semitonos sobre el CIFRADO. La partitura puede estar escrita en otra
 * tonalidad: lo que importa es que el coro cante en la misma que tocan las
 * guitarras. De ahí salen dos cosas:
 *   · cuántos semitonos se corre el audio (el teléfono lo hace en vivo), y
 *   · cómo escribir ese salto para que Verovio redibuje la partitura con la
 *     armadura más simple.
 */

/** Clase de altura de una tónica escrita como en el cifrado: C, F#, Bb… */
const ALTURA: Record<string, number> = {
  C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, F: 5, 'E#': 5,
  'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11, Cb: 11,
}

const mod12 = (n: number) => ((n % 12) + 12) % 12

/** El camino más corto, entre -6 y +5: una pista corrida 7 semitonos suena mal. */
const masCorto = (n: number) => {
  const r = mod12(n)
  return r >= 6 ? r - 12 : r
}

/**
 * La tónica de una armadura de MusicXML (`fifths`: -7 a 7) como clase de
 * altura. En menor, la relativa: tres semitonos abajo.
 */
export function tonicaDeArmadura(fifths: number, menor: boolean): number {
  return mod12(fifths * 7 + (menor ? 9 : 0))
}

/**
 * Cuántos semitonos se corre la partitura (y sus pistas) para sonar en el tono
 * elegido sobre el cifrado. Sin la tonalidad del cifrado o de la partitura, se
 * confía en que están en la misma.
 */
export function semitonosDeLaPartitura({
  transposicion,
  tonalidadCifrado,
  armadura,
  menor,
}: {
  transposicion: number
  tonalidadCifrado: string | null
  armadura: number | null
  menor: boolean
}): number {
  const tonica = tonalidadCifrado?.match(/^([A-G](?:#|b)?)/)?.[1]
  if (tonica === undefined || ALTURA[tonica] === undefined || armadura === null) return masCorto(transposicion)
  const destino = ALTURA[tonica] + transposicion
  return masCorto(destino - tonicaDeArmadura(armadura, menor))
}

/**
 * Los intervalos de cada cantidad de semitonos (hacia arriba) y cuánto mueven
 * la armadura: subir una segunda mayor suma dos sostenidos (+2 quintas), subir
 * una segunda menor suma cinco bemoles (-5).
 */
const INTERVALOS: Record<number, { nombre: string; quintas: number }[]> = {
  1: [{ nombre: 'm2', quintas: -5 }, { nombre: 'A1', quintas: 7 }],
  2: [{ nombre: 'M2', quintas: 2 }, { nombre: 'd3', quintas: -10 }],
  3: [{ nombre: 'm3', quintas: -3 }, { nombre: 'A2', quintas: 9 }],
  4: [{ nombre: 'M3', quintas: 4 }, { nombre: 'd4', quintas: -8 }],
  5: [{ nombre: 'P4', quintas: -1 }, { nombre: 'A3', quintas: 11 }],
  6: [{ nombre: 'A4', quintas: 6 }, { nombre: 'd5', quintas: -6 }],
}

/**
 * El valor de la opción `transpose` de Verovio («+M2», «-m3»; vacío = no
 * transponer). Entre las escrituras posibles del mismo salto, la que deja
 * menos alteraciones en la peor de las armaduras del canto (un canto puede
 * modular: «Cantaré por siempre» pasa de Fa a Sol). Una armadura de más de 7
 * no existe y se descarta.
 */
export function intervaloParaTransponer(semitonos: number, armaduras: number[]): string {
  if (semitonos === 0) return ''
  const signo = semitonos > 0 ? 1 : -1
  const opciones = INTERVALOS[Math.abs(semitonos)]
  if (!opciones) throw new Error(`Salto fuera de rango: ${semitonos}`)
  const base = armaduras.length > 0 ? armaduras : [0]
  const peor = (quintas: number) => Math.max(...base.map((a) => Math.abs(a + signo * quintas)))
  let mejor = opciones[0]
  for (const o of opciones.slice(1)) if (peor(o.quintas) < peor(mejor.quintas)) mejor = o
  return `${signo > 0 ? '+' : '-'}${mejor.nombre}`
}
