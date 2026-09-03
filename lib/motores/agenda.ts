/**
 * Las misas del coro, agrupadas por lo que el director pregunta el domingo.
 *
 * Función PURA, y `hoy` entra por parámetro como en el resto de los motores:
 * el día lo decide `fechaEnZona`, no el reloj del servidor.
 *
 * POR QUÉ EXISTE:
 *   La lista venía por fecha descendente y sin distinguir nada. La misa del 20
 *   de septiembre —que todavía no ocurrió— se veía igual que la del 3 de mayo,
 *   y encabezaba la lista sólo por ser la más lejana en el futuro. Para saber
 *   cuál es la próxima había que leer seis fechas y compararlas de memoria,
 *   justo la pregunta que se hace al abrir esta pantalla.
 *
 * QUÉ CUENTA COMO OCURRIDO:
 *   Fecha declarada y no futura — el MISMO criterio que el historial (§17). Si
 *   acá dijéramos otra cosa, el mismo domingo aparecería como cantado en una
 *   pantalla y como pendiente en la otra.
 */

export type ConFecha = { fecha: string | null }

export type Agenda<T> = {
  /** Todavía no ocurrieron. Ascendente: la más próxima primero. */
  proximas: T[]
  /** Ya ocurrieron. Descendente: la más reciente primero. */
  pasadas: T[]
  /** Listas de trabajo, no misas: ni ocurrieron ni están agendadas. */
  sinFecha: T[]
}

export function agruparMisas<T extends ConFecha>(lista: T[], hoy: string): Agenda<T> {
  const proximas: T[] = []
  const pasadas: T[] = []
  const sinFecha: T[] = []

  for (const c of lista) {
    if (!c.fecha) sinFecha.push(c)
    else if (c.fecha > hoy) proximas.push(c)
    else pasadas.push(c)
  }

  // Las fechas son `YYYY-MM-DD`, así que se ordenan como texto sin construir
  // un Date — que volvería a meter la zona horaria en el medio.
  proximas.sort((a, b) => (a.fecha! < b.fecha! ? -1 : 1))
  pasadas.sort((a, b) => (a.fecha! > b.fecha! ? -1 : 1))

  return { proximas, pasadas, sinFecha }
}
