/**
 * Transposición — H3, docs/PRD.md §9, reglas RN-13 y RN-16.
 *
 * Motor PURO: sin base, sin red, sin reloj.
 *
 * El cifrado guardado NUNCA cambia (PRD decisión 10): esto se aplica al leer,
 * sobre el número de semitonos que el usuario guardó en su preferencia. Por eso
 * transponer y volver es exacto, y por eso no hay dos verdades del mismo canto.
 */

/** Salida siempre en sostenidos: es la notación americana que decidió el PRD. */
const CROMATICA = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

/** De entrada se aceptan bemoles, porque el cancionero los usa (SIb → Bb). */
const INDICE: Record<string, number> = {
  C: 0, 'B#': 0,
  'C#': 1, Db: 1,
  D: 2,
  'D#': 3, Eb: 3,
  E: 4, Fb: 4,
  F: 5, 'E#': 5,
  'F#': 6, Gb: 6,
  G: 7,
  'G#': 8, Ab: 8,
  A: 9,
  'A#': 10, Bb: 10,
  B: 11, Cb: 11,
}

/** Nota (con alteración) + lo que venga después: `m`, `7`, `sus4`, `maj7`, `9`… */
const NOTA = /^([A-G](?:#|b)?)(.*)$/

/**
 * El ciclo de octava (RN-13): al completar ±12 se vuelve a 0, porque suena
 * igual. El rango útil queda en -11..11, que es el que valida la base.
 */
export function normalizarSemitonos(semitonos: number): number {
  const resto = semitonos % 12
  return resto === 0 ? 0 : resto
}

function transponerNota(nota: string, semitonos: number): string | null {
  const desde = INDICE[nota]
  if (desde === undefined) return null
  return CROMATICA[(((desde + semitonos) % 12) + 12) % 12]
}

/**
 * Transpone un acorde suelto, con su sufijo y su bajo: `A9/C#` → `A#9/D`.
 * Lo que no sea un acorde reconocible se devuelve intacto, sin lanzar.
 */
export function transponerAcorde(acorde: string, semitonos: number): string {
  if (acorde === '') return ''

  const [cuerpo, bajo] = acorde.split('/')

  const m = NOTA.exec(cuerpo)
  if (!m) return acorde

  const raiz = transponerNota(m[1], semitonos)
  if (raiz === null) return acorde

  const cuerpoNuevo = raiz + m[2]
  if (bajo === undefined) return cuerpoNuevo

  const mb = NOTA.exec(bajo)
  const raizBajo = mb ? transponerNota(mb[1], semitonos) : null
  // Un bajo irreconocible se deja como estaba en vez de romper el acorde entero.
  return raizBajo === null ? `${cuerpoNuevo}/${bajo}` : `${cuerpoNuevo}/${raizBajo}${mb![2]}`
}

/** Todo lo que esté entre corchetes, esté donde esté — también en `{comment:}` (RN-16). */
const ACORDE_EN_CIFRADO = /\[([^\]\n]+)\]/g

/**
 * Transpone el cifrado completo. La letra no se toca: solo lo que está entre
 * corchetes.
 */
export function transponer(cifrado: string, semitonos: number): string {
  const n = normalizarSemitonos(semitonos)
  if (n === 0) return cifrado
  return cifrado.replace(ACORDE_EN_CIFRADO, (_, acorde: string) => `[${transponerAcorde(acorde, n)}]`)
}
