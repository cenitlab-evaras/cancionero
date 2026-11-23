/**
 * El calendario del mes — H31, docs/PRD.md §17.
 *
 * Motor PURO: sin base, sin red y sin reloj. Recibe las misas que ya trajo la
 * consulta y el mes que se está mirando; devuelve lo que la grilla necesita.
 *
 * El mes va 0-indexado (enero = 0), igual que `Date`. La clave de un día es el
 * `AAAA-MM-DD` que ya usa toda la app para las fechas de misa.
 */

export type MesDelCalendario = {
  /** Año de cuatro cifras. */
  anio: number
  /** Mes 0-indexado: enero = 0, diciembre = 11. */
  mes: number
}

/**
 * Las fechas del mes que tienen al menos una misa.
 *
 * Se descartan dos cosas a propósito: las misas sin fecha (son listas de
 * trabajo, no días del calendario) y las de otros meses (la grilla muestra uno
 * solo). Si dos misas caen el mismo día, la clave se cuenta una vez: el día
 * tiene misa.
 */
export function diasConMisa(
  misas: { fecha: string | null }[],
  mes: MesDelCalendario
): Set<string> {
  const prefijo = `${mes.anio}-${String(mes.mes + 1).padStart(2, '0')}-`
  const dias = new Set<string>()

  for (const misa of misas) {
    if (misa.fecha && misa.fecha.startsWith(prefijo)) dias.add(misa.fecha)
  }

  return dias
}

/**
 * Las dos marcas chicas de un día con misa.
 *
 * El libro dice «tiene lecturas cargadas»; el punto, «alguien propuso
 * canciones». Son conteos, no booleanos guardados: se calculan al leer
 * (innegociable de cero derivados persistidos).
 */
export function marcasDeDia(
  lecturas: number,
  propuestas: number
): { libro: boolean; punto: boolean } {
  return { libro: lecturas > 0, punto: propuestas > 0 }
}
