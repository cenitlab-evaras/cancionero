import { transponerAcorde } from './transponer'

/**
 * Las reglas de un canto antes de guardarlo (H8 · RN-01 del funcional).
 *
 * Pura y con test, para que la pantalla y la server action apliquen exactamente
 * la misma regla y muestren exactamente el mismo texto. Si la validación viviera
 * en el formulario, la action tendría otra —o ninguna— y una entrada por POST
 * directo pasaría de largo.
 *
 * RN-01 pide «mensaje de error específico **por campo**»: por eso la salida es
 * un mapa campo → mensaje y no un string suelto. Y devuelve TODOS los errores a
 * la vez, no el primero: enterarse de a uno obliga a guardar dos veces.
 *
 * RN-02 (autor obligatorio) NO se hereda: el *Cancionero Misionero* tiene
 * muchos anónimos, `cantos.autor_id` es nullable desde H1, y el "listo cuando"
 * de H8 solo exige bloquear título y cifrado.
 */

export type CantoParaValidar = {
  titulo: string
  cifrado: string
  tonalidadOriginal?: string | null
  fuenteNumero?: number | null
  fuentePagina?: number | null
}

export type Campo = 'titulo' | 'cifrado' | 'tonalidadOriginal' | 'fuenteNumero' | 'fuentePagina'

export type ResultadoValidacion =
  | { ok: true; limpio: { titulo: string; cifrado: string; tonalidadOriginal: string | null } }
  | { ok: false; errores: Partial<Record<Campo, string>> }

export function validarCanto(canto: CantoParaValidar): ResultadoValidacion {
  const errores: Partial<Record<Campo, string>> = {}

  // El título se recorta antes de comparar: el índice único va sobre
  // lower(titulo), así que " Alma " y "Alma" tienen que ser el mismo canto.
  const titulo = canto.titulo.trim()
  if (titulo === '') errores.titulo = 'Ponle un título al canto.'

  // El cifrado NO se recorta por dentro: los espacios son los que ubican cada
  // acorde sobre su sílaba. Solo se mira si tiene algo.
  if (canto.cifrado.trim() === '') errores.cifrado = 'El cifrado no puede estar vacío.'

  const tonalidad = canto.tonalidadOriginal?.trim() || null
  if (tonalidad !== null) {
    // `transponerAcorde(x, 0)` devuelve la entrada intacta cuando no la
    // reconoce como acorde: sirve de validador sin escribir otro parser.
    const normalizada = transponerAcorde(tonalidad, 1)
    if (normalizada === tonalidad) {
      errores.tonalidadOriginal = 'No parece un acorde. Por ejemplo: D, Am, F#m.'
    }
  }

  if (canto.fuenteNumero != null && canto.fuenteNumero <= 0) {
    errores.fuenteNumero = 'El número del canto en el cancionero es un entero positivo.'
  }
  if (canto.fuentePagina != null && canto.fuentePagina <= 0) {
    errores.fuentePagina = 'La página es un entero positivo.'
  }

  if (Object.keys(errores).length > 0) return { ok: false, errores }

  return { ok: true, limpio: { titulo, cifrado: canto.cifrado, tonalidadOriginal: tonalidad } }
}
