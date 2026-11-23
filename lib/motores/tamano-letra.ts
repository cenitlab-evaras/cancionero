/**
 * El tamaño de letra del cifrado — RN-14, revisada el 2026-11-23.
 *
 * Es de la PERSONA (`preferencias_perfil.tamano_letra`), no del canto: quien ve
 * poco lo elige una vez y vale en todo el repertorio y en toda la misa. La
 * transposición sí sigue siendo por canto.
 *
 * Tres presets reales —Pequeño 18 px, Regular 22 px, Grande 28 px— en vez de la
 * grilla de 14 a 32 de a 2: el número suelto no le decía nada a nadie y los
 * pasos chicos obligaban a tocar cinco veces para llegar a un tamaño legible.
 * La columna sigue guardando píxeles; lo que se elige se guarda como el píxel
 * de su preset, y lo viejo se normaliza al leer.
 */

export const TAMANOS = ['pequeno', 'regular', 'grande'] as const

export type TamanoDeLetra = (typeof TAMANOS)[number]

export const PIXELES: Record<TamanoDeLetra, number> = {
  pequeno: 18,
  regular: 22,
  grande: 28,
}

export const TAMANO_POR_DEFECTO: TamanoDeLetra = 'regular'

/**
 * A qué preset corresponde un píxel guardado, incluidos los de la grilla vieja.
 *
 * Los cortes caen a mitad de camino entre presets (19 y 25), así que un 14–19
 * queda en Pequeño, un 20–25 en Regular y de 26 en adelante en Grande. Es lo
 * que normaliza `preferenciasDelPerfil` al leer: la base no se migra.
 */
export function presetDePixeles(px: number): TamanoDeLetra {
  if (px <= 19) return 'pequeno'
  if (px <= 25) return 'regular'
  return 'grande'
}

/**
 * Un preset más grande (`+1`) o más chico (`-1`).
 *
 * Los extremos son topes: en Grande, subir deja Grande. La lista `TAMANOS` es
 * la única fuente del orden.
 */
export function siguienteTamano(actual: TamanoDeLetra, direccion: 1 | -1): TamanoDeLetra {
  const indice = TAMANOS.indexOf(actual) + direccion
  return TAMANOS[Math.min(TAMANOS.length - 1, Math.max(0, indice))]
}

/** Solo los píxeles de los presets llegan a guardarse. */
export function esTamanoValido(valor: unknown): valor is number {
  return typeof valor === 'number' && (Object.values(PIXELES) as number[]).includes(valor)
}

/**
 * Un preset más grande (`+1`) o más chico (`-1`), en píxeles.
 *
 * Acepta un preset o un píxel: un valor viejo (16, 24) se normaliza antes de
 * moverse, para que el primer toque caiga en el preset siguiente y no dos
 * pasos más allá. Devuelve el píxel del preset para que sea lo que se guarda.
 */
export function cambiarTamano(actual: TamanoDeLetra | number, direccion: 1 | -1): number {
  const preset = typeof actual === 'number' ? presetDePixeles(actual) : actual
  return PIXELES[siguienteTamano(preset, direccion)]
}
