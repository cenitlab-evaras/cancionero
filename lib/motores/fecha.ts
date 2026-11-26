/**
 * Qué día es "hoy" para el coro — docs/PRD.md §17.1-octies.
 *
 * Función PURA: recibe el instante en vez de leer el reloj, para que el día
 * que decide el historial se pueda probar contra casos concretos y no dependa
 * de a qué hora corran los tests.
 *
 * Por qué existe este archivo: H13 dejó declarado que `hoyISO()` usaba la zona
 * del proceso, y que en un servidor en UTC —el contenedor de producción lo es—
 * entre las 20:00 y la medianoche en Chile el día se adelantaría. El motor de
 * historial siempre estuvo bien: recibe `hoy` por parámetro. Lo que faltaba era
 * que ese string se calculara en la zona del coro y no en la del servidor.
 *
 * Esto NO es una preferencia de formato: el motor compara fechas como strings
 * (`e.fecha <= hoy`) para decidir qué misa ya ocurrió. Un día de más convierte
 * una misa agendada en una misa cantada.
 */

/**
 * La zona del coro, explícita.
 *
 * Es una constante y no una variable de entorno a propósito: el producto es de
 * un coro chileno, y una zona mal configurada en el servidor fallaría en
 * silencio. El día que Cantoral sirva a un coro en otro huso, esto pasa a ser
 * un dato del coro (una columna en `coros`) y no una constante del código.
 */
export const ZONA_DEL_CORO = 'America/Santiago'

/**
 * El día de `instante` en `zona`, como `YYYY-MM-DD`.
 *
 * `sv-SE` porque su formato local ES el ISO, sin recortar strings a mano.
 */
export function fechaEnZona(instante: Date, zona: string = ZONA_DEL_CORO): string {
  return instante.toLocaleDateString('sv-SE', { timeZone: zona })
}

/** Un `YYYY-MM-DD` como día del calendario, sin hora ni zona que lo corra. */
function comoDiaUTC(iso: string): Date {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d))
}

/**
 * «domingo 18 de octubre»: la misa se nombra por su día, como en el coro.
 *
 * Se arma en UTC a propósito: la fecha guardada no tiene hora, y leerla en la
 * zona del proceso podía correrla un día hacia atrás.
 */
export function fechaLarga(iso: string): string {
  return comoDiaUTC(iso)
    .toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .replace(',', '')
}

/** «Hoy», «Mañana», «En 7 días» — o `null` si ya pasó. `hoy` entra por parámetro. */
export function cuantoFalta(iso: string, hoy: string): string | null {
  const dias = Math.round((comoDiaUTC(iso).getTime() - comoDiaUTC(hoy).getTime()) / 86_400_000)
  if (dias < 0) return null
  if (dias === 0) return 'Hoy'
  if (dias === 1) return 'Mañana'
  return `En ${dias} días`
}

/**
 * El día, el mes corto y el día de la semana corto de una fecha: la ficha de
 * fecha de la bandeja de Inicio (2026-11-25).
 *
 * Se arma en UTC, como `fechaLarga`: la fecha no tiene hora. El `es-CL` devuelve
 * el punto abreviativo («sáb.», «nov.»); se quita para que la ficha quede
 * limpia en dos o tres letras.
 */
export function partesDeFecha(iso: string): { dia: string; mes: string; semana: string } {
  const partes = new Intl.DateTimeFormat('es-CL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).formatToParts(comoDiaUTC(iso))
  const de = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((p) => p.type === tipo)?.value ?? ''
  return {
    dia: de('day'),
    mes: de('month').replace('.', ''),
    semana: de('weekday').replace('.', ''),
  }
}

/**
 * El día `iso` corrido `dias` (negativo para atrás), como `YYYY-MM-DD`.
 *
 * Se mueve en UTC, igual que `fechaLarga`: la fecha no tiene hora, y sumar un
 * día sobre una fecha local a medianoche puede caer en el día equivocado por
 * el horario de verano. Vacío entra, vacío sale: no se inventa un día.
 */
export function moverDia(iso: string, dias: number): string {
  if (!iso) return ''
  const dia = comoDiaUTC(iso)
  dia.setUTCDate(dia.getUTCDate() + dias)
  return dia.toISOString().slice(0, 10)
}
