/**
 * El tema de la app (2026-10-17, a pedido del dueño): oscuro, el de siempre, o
 * claro. Se guarda en una cookie para que el servidor pinte la página ya en el
 * tema elegido, sin un destello del otro al cargar. Sin cookie, oscuro.
 */
export const COOKIE_TEMA = 'cantoral_tema'
export type Tema = 'oscuro' | 'claro'

/** El color de la barra del navegador: el `--color-fondo` de cada tema. */
export const COLOR_BARRA: Record<Tema, string> = { oscuro: '#15110d', claro: '#faf6ee' }

export function esTema(valor: unknown): valor is Tema {
  return valor === 'oscuro' || valor === 'claro'
}
