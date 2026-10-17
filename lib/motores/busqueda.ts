/**
 * Búsqueda del repertorio — RF-02 del funcional heredado.
 *
 * Motor PURO: sin base de datos, sin red, sin reloj. Se filtra en el servidor
 * sobre las filas que la RLS ya dejó pasar; no hay `ilike` en la consulta
 * porque el criterio (ignorar acentos) es una regla del producto, no del motor
 * de base de datos.
 */

/** Diacríticos combinantes, salvo U+0303 (la tilde de la ñ). */
const DIACRITICOS = /[̀-̂̄-ͯ]/g

/**
 * Baja a minúsculas, quita acentos y normaliza los espacios.
 *
 * La `ñ` se conserva a propósito: en español no es una `n` acentuada sino otra
 * letra, y buscar "nino" no debería encontrar "Niño".
 */
export function normalizarBusqueda(texto: string | null | undefined): string {
  if (!texto) return ''
  return texto
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export type CantoBuscable = {
  titulo: string
  autor?: string | null
  /** El número en el cancionero impreso: el coro busca de memoria «el 34». */
  numero?: number | null
}

/**
 * ¿Este canto coincide con el término? Compara contra título y autor, y si el
 * término es solo un número, también contra el número del cancionero, EXACTO:
 * buscar «3» no debe traer el 34, el 35 y el 136.
 * Un término vacío coincide con todo: no filtra nada.
 */
export function coincideBusqueda(canto: CantoBuscable, termino: string): boolean {
  const aguja = normalizarBusqueda(termino)
  if (aguja === '') return true
  if (/^\d+$/.test(aguja) && canto.numero != null && String(canto.numero) === aguja) return true
  const pajar = `${normalizarBusqueda(canto.titulo)} ${normalizarBusqueda(canto.autor)}`
  return pajar.includes(aguja)
}

export type OpcionBuscable = {
  texto: string
  detalle?: string | null
  /** Palabras con que alguien la buscaría y que la fila no muestra. */
  claves?: readonly string[]
}

/**
 * ¿Esta opción de una sección coincide con el término? (el dueño, 2026-10-17:
 * la lupa de «Más» busca una herramienta, no una canción). Cada palabra del
 * término tiene que estar en el nombre, el detalle o las claves, sin importar
 * el orden: «tono nuevo» encuentra la fila que dice «dar el tono» y tiene la
 * clave «cargar un canto nuevo». Un término vacío coincide con todo.
 */
export function coincideOpcion(opcion: OpcionBuscable, termino: string): boolean {
  const palabras = normalizarBusqueda(termino).split(' ').filter(Boolean)
  if (palabras.length === 0) return true
  const pajar = normalizarBusqueda(
    [opcion.texto, opcion.detalle ?? '', ...(opcion.claves ?? [])].join(' '),
  )
  return palabras.every((p) => pajar.includes(p))
}
