/**
 * La geometría de los velos — la franja blanca que apaga entera la cuerda que
 * no suena (plicas, corchetes, silencios y sílabas incluidos). Motor PURO.
 *
 * Vive acá y no en cada hoja porque las dos (la de MuseScore y la que Verovio
 * redibuja al cambiar de tono) usan la misma aritmética: la primera franja
 * sube 450 unidades sobre su pentagrama, las del medio llegan a la mitad del
 * hueco con su vecina (más 150) y la última baja 650. Todo en unidades del
 * pentagrama (`unidad` = su espacio).
 *
 * La entrada es la que hay, no la que uno querría: Verovio repite el juego de
 * pentagramas dentro de un mismo `g.system` (una vez por voz), las líneas de un
 * pentagrama pueden venir en cualquier orden, y nada garantiza el orden
 * vertical. Sin normalizar, la "mitad entre vecinos" cerraba al revés y salían
 * `<rect height="-3600">`: inválidos, y en consola en cada preparación de la
 * hoja (2026-11-17).
 */

export type FranjaDeVelo = { y0: number; y1: number }

/**
 * Una franja por pentagrama distinto, de arriba abajo y siempre con alto
 * positivo. Los pentagramas repetidos (misma línea superior) se dejan una vez;
 * los que no tienen ninguna línea usable se descartan en vez de dibujar un
 * rectángulo inválido.
 */
export function franjasDeVelos(
  pentagramas: { ys: number[] }[],
  unidad: number
): FranjaDeVelo[] {
  // Por la línea superior: dos pentagramas con el mismo techo son el mismo,
  // repetido por la voz (Verovio), y su caja es la misma.
  const unicos = new Map<number, { top: number; bottom: number }>()
  for (const p of pentagramas) {
    const ys = p.ys.filter(Number.isFinite)
    if (ys.length === 0) continue
    const top = Math.min(...ys)
    unicos.set(top, { top, bottom: Math.max(...ys) })
  }
  const ordenados = [...unicos.values()].sort((a, b) => a.top - b.top)

  return ordenados.map(({ top, bottom }, i) => {
    const y0 =
      i === 0 ? top - 450 * unidad : (ordenados[i - 1].bottom + top) / 2 + 150 * unidad
    const y1 =
      i === ordenados.length - 1
        ? bottom + 650 * unidad
        : (bottom + ordenados[i + 1].top) / 2 + 150 * unidad
    return { y0, y1 }
  })
}
