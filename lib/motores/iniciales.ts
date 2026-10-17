/**
 * Las iniciales de una persona, para el círculo de quienes se anotaron a una
 * misa (pedido del dueño, 2026-10-17). Motor PURO.
 *
 * Del nombre: la primera letra del primer nombre y del último apellido, sin
 * partículas («José de la Fuente» → JF). Sin nombre, del correo («juan.soto@»
 * → JS). Un solo nombre, sus dos primeras letras: una letra sola se confunde.
 */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y'])

function deTexto(texto: string): string {
  const partes = texto
    .split(/[\s._-]+/)
    .filter((p) => p && !PARTICULAS.has(p.toLowerCase()))
  if (partes.length === 0) return ''
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

export function iniciales(nombre: string | null, email: string | null): string {
  return deTexto(nombre?.trim() ?? '') || deTexto(email?.split('@')[0] ?? '') || '?'
}
