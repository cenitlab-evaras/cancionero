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
}

/**
 * ¿Este canto coincide con el término? Compara contra título y autor.
 * Un término vacío coincide con todo: no filtra nada.
 */
export function coincideBusqueda(canto: CantoBuscable, termino: string): boolean {
  const aguja = normalizarBusqueda(termino)
  if (aguja === '') return true
  const pajar = `${normalizarBusqueda(canto.titulo)} ${normalizarBusqueda(canto.autor)}`
  return pajar.includes(aguja)
}
