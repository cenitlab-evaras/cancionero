/**
 * Ancho del cifrado: cuántos caracteres entran sin encoger la letra.
 *
 * La letra se ve SIEMPRE al tamaño del preset. Si no entra en el ancho del
 * contenedor, no se achica: se parte en más líneas (menos columnas). Así el
 * control de tamaño no miente — pedir 28 px da 28 px.
 *
 * Motor puro: sin DOM, sin React. El componente mide el ancho y se lo pasa.
 */

/**
 * Ancho de un carácter, en fracción del tamaño de fuente.
 *
 * JetBrains Mono mide exactamente 0.6em (DESIGN.md · Typography); el 0.615 deja
 * un pelo de aire por si la fuente todavía no cargó y el navegador dibuja con
 * la mono de sistema, que puede ser un poco más ancha.
 */
export const ANCHO_CARACTER = 0.615

/**
 * Piso de columnas para un ancho diminuto. Menos que esto no se lee como
 * cifrado, por angosto que sea el contenedor; si igual no cabe, el motor parte
 * las palabras largas (`partirAlAncho`).
 */
const COLUMNAS_MINIMAS = 14

/**
 * Cuántos caracteres por línea entran a `tamano` px en `anchoPx` px.
 *
 * @param tamano   Tamaño de fuente del preset, en px. No se modifica.
 * @param anchoPx  Ancho medido del contenedor, en px.
 */
export function columnasPara(tamano: number, anchoPx: number): number {
  return Math.max(COLUMNAS_MINIMAS, Math.floor(anchoPx / (tamano * ANCHO_CARACTER)))
}
