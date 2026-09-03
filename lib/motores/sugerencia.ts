/**
 * El ranking de sugerencias — H17, docs/PRD.md §17 y §19.2-B9.
 *
 * Función PURA y sin datos: la comparten `/sugerencias`, la vista del canto y
 * el armador de la misa, para que el número que se ve y la regla que lo produce
 * no puedan divergir.
 *
 * DETERMINISTA, por §10. «El director puede escoger la que más se repite o la
 * que más se quiere cantar» es un recuento ordenado, no un modelo: dos personas
 * mirando el mismo día ven exactamente lo mismo, y el orden se puede explicar
 * con una frase.
 *
 * Esto NO es seguridad. Quién puede proponer y quién puede ver lo deciden
 * `permisos.ts` y `sugerencia_select` / `sugerencia_write` — la misma regla de
 * §19.5 que abrió H15: se escribe solo la fila propia, la lee todo el coro.
 */

export type Sugerencia = {
  cantoId: string
  titulo: string
  perfilId: string
  nombre: string | null
  momentoId: string
  momentoNombre: string
  /** `null` = propuesta general para el momento. No nulo = para esa misa. */
  misaId: string | null
  /** ISO. Entra como dato y no se lee el reloj: el motor tiene que ser probable. */
  creada: string
}

export type FilaDelRanking = {
  cantoId: string
  titulo: string
  momentoId: string
  momentoNombre: string
  /** Cuántas PERSONAS distintas lo pidieron. */
  cuantas: number
  /** Quiénes, en el orden en que se fueron sumando. */
  quienes: string[]
  /** La más reciente de las que componen esta fila. Desempata. */
  ultima: string
}

/**
 * Cuenta y ordena. Nada más, y esa es la gracia.
 *
 * LA UNIDAD DEL RANKING ES (canto × momento), NO EL CANTO. Proponer un canto
 * para Comunión y para Ofertorio son dos propuestas: el director elige qué
 * cantar en cada momento, así que sumarlas le daría un número que no puede usar.
 *
 * LAS GENERALES Y LAS DE MISA NO SE MEZCLAN ACÁ. Esta función rankea la lista
 * que se le pasa; quien llama le pasa una o la otra. Es la resolución de la
 * contradicción que §18-12 anticipó: en vez de arbitrar cuál manda, se aceptan
 * como dos preguntas distintas y se muestran en dos bloques. Un ranking que las
 * sumara daría un número que no contesta ninguna de las dos.
 *
 * Cuenta PERSONAS y no filas: la base ya impide que alguien proponga dos veces
 * lo mismo —dos índices parciales, por la trampa de los NULL—, pero un motor que
 * confía en eso miente el día que la base cambie.
 */
export function rankear(sugerencias: Sugerencia[]): FilaDelRanking[] {
  const filas = new Map<string, FilaDelRanking>()
  // Quiénes ya contaron en cada fila. Va aparte y no dentro de la fila para que
  // el tipo que sale de acá sea exactamente el que la pantalla necesita, sin un
  // campo interno que después haya que recordar no dibujar.
  const vistos = new Map<string, Set<string>>()

  for (const s of sugerencias) {
    const clave = `${s.cantoId}·${s.momentoId}`
    const fila = filas.get(clave) ?? {
      cantoId: s.cantoId,
      titulo: s.titulo,
      momentoId: s.momentoId,
      momentoNombre: s.momentoNombre,
      cuantas: 0,
      quienes: [],
      ultima: s.creada,
    }
    const yaContados = vistos.get(clave) ?? new Set<string>()

    if (!yaContados.has(s.perfilId)) {
      yaContados.add(s.perfilId)
      fila.quienes.push(s.nombre ?? s.perfilId)
      fila.cuantas += 1
    }
    if (s.creada > fila.ultima) fila.ultima = s.creada

    filas.set(clave, fila)
    vistos.set(clave, yaContados)
  }

  return [...filas.values()]
    .sort((a, b) => {
      if (b.cuantas !== a.cuantas) return b.cuantas - a.cuantas
      // A igual cantidad, primero la más reciente — el mismo desempate que usa
      // el historial de H13. Entre dos propuestas empatadas, la que se pidió
      // hace poco es la que está viva.
      return a.ultima > b.ultima ? -1 : 1
    })
}

/**
 * Si esta persona ya propuso ESTE canto para ESTE momento y ESTE alcance.
 *
 * El alcance importa: proponer «Alma misionera» para Comunión en general no es
 * proponerla para el domingo 20. Son dos filas distintas en la base —dos
 * índices únicos parciales— y el control tiene que poder decirlo, o la persona
 * toca «sugerir» y no pasa nada aparente.
 */
export function yaSugirio(
  mias: Sugerencia[],
  cantoId: string,
  momentoId: string,
  misaId: string | null
): boolean {
  return mias.some(
    (s) => s.cantoId === cantoId && s.momentoId === momentoId && s.misaId === misaId
  )
}
