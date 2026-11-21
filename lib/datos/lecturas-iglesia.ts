import {
  extraerLecturasDeIglesia,
  type ExtraccionDeLecturas,
} from '../motores/lecturas-iglesia'
import type { ParteDeLectura } from '../motores/lecturas'

/**
 * Trae las lecturas de la página pública de Eucaristía Diaria (Iglesia.cl)
 * para una fecha — H30, docs/PRD.md §9.
 *
 * Vive en `lib/datos/` porque hace red; el parseo sigue en el motor puro
 * `extraerLecturasDeIglesia`. Sin reintentos en cadena: si el sitio falla, el
 * resultado lo dice y el director pega el texto a mano o edita lo guardado.
 */

/** La página que publica el leccionario del día. */
const URL_BASE = 'https://www.eucaristiadiaria.cl/dia_cal.php'

/** El sitio no nos conoce: el agente dice quién pide y dónde responder. */
const AGENTE = 'Cantoral/1.0 (+https://cantoral.cenitlab.cl)'

/** Tope de espera: más que esto y la importación ya no sirve para la pantalla. */
const TIEMPO_LIMITE_MS = 8000

/**
 * Por qué no se pudieron traer las lecturas.
 *
 * - `sin_datos`: la página no trae lecturas publicadas para esa fecha.
 * - `complejo`: el día trae varios formularios, una secuencia o más de dos
 *   lecturas; el director lo pega a mano.
 * - `fecha`: el sitio respondió con la página de otro día.
 * - `red`: el sitio no respondió, respondió con error o el HTML no se pudo leer.
 */
export type MotivoDeTraida = 'sin_datos' | 'complejo' | 'fecha' | 'red'

export type ResultadoTraida =
  | {
      ok: true
      /** Las partes en orden litúrgico, listas para guardar. */
      partes: ParteDeLectura[]
      /** La fecha ISO de la página, igual a la pedida. */
      fecha: string
      /** La URL exacta que se pidió. */
      url: string
    }
  | { ok: false; motivo: MotivoDeTraida }

/**
 * Descarga la página del día y devuelve sus lecturas.
 *
 * El extractor lee la fecha de la página; acá se exige que coincida con la
 * pedida. Si el sitio responde con el día de otro santo, no se importa: sería
 * peor leer las lecturas equivocadas que no traer ninguna.
 *
 * `fetchImpl` entra como parámetro para poder probar sin red.
 */
export async function traerLecturasDeIglesia(
  fecha: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ResultadoTraida> {
  const url = `${URL_BASE}?fecha=${fecha}`

  let extraccion: ExtraccionDeLecturas
  try {
    const respuesta = await fetchImpl(url, {
      headers: { 'User-Agent': AGENTE },
      signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
      cache: 'no-store',
    })
    if (!respuesta.ok) return { ok: false, motivo: 'red' }
    const html = await respuesta.text()
    // El parseo también vive en el try: una excepción del extractor no debe
    // rechazar la promesa y dejar a la acción sin el contrato `ResultadoTraida`.
    extraccion = extraerLecturasDeIglesia(html)
  } catch {
    return { ok: false, motivo: 'red' }
  }

  if (extraccion.complejo) return { ok: false, motivo: 'complejo' }
  if (extraccion.partes.length === 0) return { ok: false, motivo: 'sin_datos' }

  // Comparación obligatoria: la página tiene que ser la del día pedido. Va
  // después de `sin_datos` porque la página vacía no trae fecha y su motivo es
  // que no hay lecturas, no que el sitio haya respondido otro día.
  if (extraccion.fecha !== fecha) return { ok: false, motivo: 'fecha' }

  return { ok: true, partes: extraccion.partes, fecha, url }
}
