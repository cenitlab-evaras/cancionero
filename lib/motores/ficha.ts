/**
 * La ficha de una persona dentro de un coro — H14, docs/PRD.md §17 y §19.2-B5.
 *
 * Función PURA y sin datos: la comparten /mi-ficha, /coro/miembros y la server
 * action, para que el texto que se ve y la regla que se aplica no diverjan.
 *
 * Esto NO es seguridad. Quién puede leer y escribir una ficha lo decide la RLS
 * (`ficha_miembro_select` / `ficha_miembro_write`) y lo refleja `permisos.ts`.
 * Acá solo vive qué es un valor válido, cómo se lee y cómo se calcula la edad.
 *
 * `hoy` entra por parámetro, como en el motor de historial: un motor que llama
 * a `new Date()` no se puede probar contra casos concretos, y además decidiría
 * el día en la zona del servidor en vez de la del coro (ver `fecha.ts`).
 */

/** De voz aguda a grave: el orden en que se lista un coro. */
export const TESITURAS = [
  'soprano',
  'mezzosoprano',
  'contralto',
  'tenor',
  'baritono',
  'bajo',
] as const

/**
 * Tres niveles nombrados, decididos el 2026-09-02.
 *
 * No es un 1-5 a propósito: un número invita a una precisión que nadie tiene
 * sobre su propia disponibilidad, y obliga a decidir si 3 es "regular" o "más
 * bien sí".
 */
export const DISPONIBILIDADES = ['rara_vez', 'a_veces', 'casi_siempre'] as const

export type Tesitura = (typeof TESITURAS)[number]
export type Disponibilidad = (typeof DISPONIBILIDADES)[number]

const ETIQUETA_TESITURA: Record<Tesitura, string> = {
  soprano: 'Soprano',
  mezzosoprano: 'Mezzosoprano',
  contralto: 'Contralto',
  tenor: 'Tenor',
  baritono: 'Barítono',
  bajo: 'Bajo',
}

const ETIQUETA_DISPONIBILIDAD: Record<Disponibilidad, string> = {
  rara_vez: 'Rara vez',
  a_veces: 'A veces',
  casi_siempre: 'Casi siempre',
}

/** Lo que se muestra cuando el dato no está cargado. La ficha es opcional. */
const SIN_DECLARAR = 'Sin declarar'

export function esTesituraValida(valor: unknown): valor is Tesitura {
  return typeof valor === 'string' && (TESITURAS as readonly string[]).includes(valor)
}

export function esDisponibilidadValida(valor: unknown): valor is Disponibilidad {
  return typeof valor === 'string' && (DISPONIBILIDADES as readonly string[]).includes(valor)
}

export function etiquetaTesitura(valor: unknown): string {
  return esTesituraValida(valor) ? ETIQUETA_TESITURA[valor] : SIN_DECLARAR
}

export function etiquetaDisponibilidad(valor: unknown): string {
  return esDisponibilidadValida(valor) ? ETIQUETA_DISPONIBILIDAD[valor] : SIN_DECLARAR
}

/**
 * Los años cumplidos al día `hoy`, o `null` si no hay fecha cargada.
 *
 * Se compara mes y día, no solo el año: restar años a secas le da un año de más
 * a quien todavía no cumplió. Las dos fechas llegan como `YYYY-MM-DD`, así que
 * se comparan como texto —`'09-03' > '09-02'`— sin construir un Date, que
 * volvería a meter la zona horaria en el medio.
 */
export function edadEn(fechaNacimiento: string | null, hoy: string): number | null {
  if (!fechaNacimiento) return null

  const [anioNace, restoNace] = partir(fechaNacimiento)
  const [anioHoy, restoHoy] = partir(hoy)
  if (anioNace === null || anioHoy === null) return null

  const cumplioEsteAnio = restoHoy >= restoNace
  return anioHoy - anioNace - (cumplioEsteAnio ? 0 : 1)
}

/** `YYYY-MM-DD` → [año, 'MM-DD']. */
function partir(iso: string): [number | null, string] {
  const anio = Number(iso.slice(0, 4))
  return [Number.isFinite(anio) ? anio : null, iso.slice(5)]
}

/**
 * Si la persona todavía no cumplió 18 al día `hoy`.
 *
 * Devuelve `null` —y no `false`— cuando no hay fecha: afirmar que alguien es
 * mayor de edad sin saberlo sería inventar, y en un contexto parroquial ese
 * dato tiene consecuencias reales.
 */
export function esMenorDeEdad(fechaNacimiento: string | null, hoy: string): boolean | null {
  const edad = edadEn(fechaNacimiento, hoy)
  return edad === null ? null : edad < 18
}

/**
 * De voz aguda a grave, con quien no declaró tesitura al final.
 *
 * Devuelve un arreglo nuevo: ordenar en el lugar rompería el orden alfabético
 * que trae la consulta cuando la pantalla quiera las dos cosas.
 */
export function ordenarPorTesitura<T extends { tesitura: string | null }>(gente: T[]): T[] {
  const posicion = (t: string | null) =>
    esTesituraValida(t) ? TESITURAS.indexOf(t) : TESITURAS.length

  return [...gente].sort((a, b) => posicion(a.tesitura) - posicion(b.tesitura))
}
