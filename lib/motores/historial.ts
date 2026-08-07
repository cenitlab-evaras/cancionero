/**
 * Historial y métricas de uso de un canto — H13, docs/PRD.md §9 y B1 (A+B).
 *
 * Motor PURO: entra lo que H6 ya guardó —qué canto, en qué misa, en qué momento
 * y con qué fecha— y sale cuántas veces se cantó, hace cuánto y cada cuánto.
 * Cero tablas nuevas: la celebración armada ES el historial.
 *
 * DOS REGLAS QUE SOSTIENEN TODO LO DEMÁS:
 *
 * 1. **Cuenta lo que ya ocurrió.** Una celebración con fecha futura está
 *    agendada, no cantada; una sin fecha —el ensayo de §18-6— nunca ocurrió en
 *    una misa. Si contaran, «cantado 5 veces» dejaría de significar algo.
 *
 * 2. **`hoy` entra por parámetro.** Un motor que llama a `new Date()` no se
 *    puede probar: "hace cuánto" daría distinto según el día en que corran los
 *    tests. La fecha del reloj la pone quien llama, una sola vez.
 *
 * Nada de esto se persiste (innegociable 4): se calcula al leer.
 */

/** Una fila de `celebracion_cantos` cruzada con su celebración. */
export type EjecucionCruda = {
  cantoId: string
  celebracionId: string
  celebracionNombre: string
  /** `YYYY-MM-DD`, o null si la celebración no declara fecha (§18-6). */
  fecha: string | null
  momento: string
}

/** Una vez que el canto sonó en una misa que ya ocurrió. */
export type Ejecucion = {
  celebracionId: string
  celebracionNombre: string
  fecha: string
  momento: string
}

export type HistorialCanto = {
  veces: number
  /** La más reciente, o null si nunca se cantó. */
  ultima: string | null
  diasDesdeUltima: number | null
  /** Promedio de días ENTRE ejecuciones. Null con menos de dos. */
  cadaCuantosDias: number | null
  /** De la más reciente a la más vieja. */
  ejecuciones: Ejecucion[]
  /**
   * Las misas con fecha FUTURA donde el canto ya está puesto, de la más próxima
   * a la más lejana. No suman en `veces` —todavía no se cantaron— pero se
   * informan igual: sin esto, quien armó la misa del domingo abre el canto, lee
   * "nunca se cantó" y concluye que la app perdió su trabajo.
   */
  agendadas: Ejecucion[]
  /** En qué parte de la misa se usó, del momento más frecuente al menos. */
  porMomento: { momento: string; veces: number }[]
}

const MS_POR_DIA = 86_400_000

/**
 * Días entre dos fechas `YYYY-MM-DD`.
 *
 * Se interpretan como UTC —el sufijo `T00:00:00Z`— a propósito: son fechas de
 * calendario, no instantes. Sin eso, el mismo par de fechas daría 34 o 35 días
 * según el huso y el horario de verano de quien mira la pantalla.
 */
function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(`${desde}T00:00:00Z`)
  const b = Date.parse(`${hasta}T00:00:00Z`)
  return Math.round((b - a) / MS_POR_DIA)
}

/** Descarta las que no tienen fecha y ordena; `cuales` elige pasadas o futuras. */
function conFecha(
  crudas: EjecucionCruda[],
  hoy: string,
  cuales: 'ocurridas' | 'agendadas'
): Ejecucion[] {
  return crudas
    .filter((e): e is EjecucionCruda & { fecha: string } => {
      if (e.fecha === null) return false // una lista sin fecha no ocurrió ni está agendada
      return cuales === 'ocurridas' ? e.fecha <= hoy : e.fecha > hoy
    })
    .map((e) => ({
      celebracionId: e.celebracionId,
      celebracionNombre: e.celebracionNombre,
      fecha: e.fecha,
      momento: e.momento,
    }))
    // Las ocurridas, de la más reciente hacia atrás; las agendadas, de la más
    // próxima hacia adelante. Las dos van "desde hoy" hacia afuera.
    .sort((a, b) =>
      cuales === 'ocurridas' ? b.fecha.localeCompare(a.fecha) : a.fecha.localeCompare(b.fecha)
    )
}

export function historialDeCanto(crudas: EjecucionCruda[], hoy: string): HistorialCanto {
  const ejecuciones = conFecha(crudas, hoy, 'ocurridas')
  const agendadas = conFecha(crudas, hoy, 'agendadas')

  if (ejecuciones.length === 0) {
    // Nunca cantado. Todo null y no 0: un 0 en "hace cuánto" se leería como
    // "hoy", que es exactamente lo contrario de lo que pasó.
    return {
      veces: 0,
      ultima: null,
      diasDesdeUltima: null,
      cadaCuantosDias: null,
      ejecuciones: [],
      agendadas,
      porMomento: [],
    }
  }

  const ultima = ejecuciones[0].fecha

  // El espaciado necesita al menos dos puntos. Con uno solo es null, no 0:
  // un 0 diría "se canta todos los días".
  let cadaCuantosDias: number | null = null
  if (ejecuciones.length > 1) {
    const masVieja = ejecuciones[ejecuciones.length - 1].fecha
    cadaCuantosDias = Math.round(diasEntre(masVieja, ultima) / (ejecuciones.length - 1))
  }

  const cuentaPorMomento = new Map<string, number>()
  for (const e of ejecuciones) {
    cuentaPorMomento.set(e.momento, (cuentaPorMomento.get(e.momento) ?? 0) + 1)
  }

  return {
    veces: ejecuciones.length,
    ultima,
    diasDesdeUltima: diasEntre(ultima, hoy),
    cadaCuantosDias,
    ejecuciones,
    agendadas,
    porMomento: [...cuentaPorMomento.entries()]
      .map(([momento, veces]) => ({ momento, veces }))
      // A igual frecuencia, alfabético: sin desempate, el orden dependería de
      // en qué orden llegaron las filas de la base.
      .sort((a, b) => b.veces - a.veces || a.momento.localeCompare(b.momento)),
  }
}

/**
 * El historial de TODO el repertorio en una pasada.
 *
 * Agrupa por canto acá y no con una consulta por canto: el listado necesita los
 * trece de una vez, y trece consultas serían trece viajes a la base para
 * calcular algo que cabe en memoria.
 */
export function resumirHistorial(
  crudas: EjecucionCruda[],
  hoy: string
): Map<string, HistorialCanto> {
  const porCanto = new Map<string, EjecucionCruda[]>()
  for (const e of crudas) {
    const lista = porCanto.get(e.cantoId) ?? []
    lista.push(e)
    porCanto.set(e.cantoId, lista)
  }

  const salida = new Map<string, HistorialCanto>()
  for (const [cantoId, lista] of porCanto) {
    salida.set(cantoId, historialDeCanto(lista, hoy))
  }
  return salida
}

/**
 * El orden de `/historial`: del más usado al menos, y los nunca cantados al
 * final pero JUNTOS y alfabéticos.
 *
 * Van al final porque la primera pregunta de esa pantalla es "qué usamos"; van
 * juntos y ordenados por título porque la segunda —"qué estamos dejando
 * morir"— se contesta leyendo justo ese bloque, y un bloque en orden aleatorio
 * no se lee.
 */
export function ordenarPorUso<T extends { titulo: string; historial: HistorialCanto }>(
  cantos: T[]
): T[] {
  return [...cantos].sort((a, b) => {
    if (a.historial.veces !== b.historial.veces) return b.historial.veces - a.historial.veces
    if (a.historial.ultima && b.historial.ultima && a.historial.ultima !== b.historial.ultima) {
      return b.historial.ultima.localeCompare(a.historial.ultima)
    }
    return a.titulo.localeCompare(b.titulo)
  })
}

/**
 * Los días en palabras: «hoy», «hace 3 semanas», «hace 2 meses».
 *
 * Está acá y no en la pantalla porque lo usan la vista del canto y `/historial`,
 * y porque es exactamente el tipo de código que se escribe de memoria y falla en
 * los bordes —el día 7, el día 30— sin que nadie lo note.
 *
 * La unidad sube a medida que el número crece: a partir de cierta distancia,
 * «hace 47 días» obliga a hacer una cuenta y «hace 7 semanas» no.
 */
export function describirAntiguedad(dias: number | null): string {
  if (dias === null) return 'nunca'
  if (dias === 0) return 'hoy'
  if (dias === 1) return 'ayer'
  if (dias < 7) return `hace ${dias} días`
  if (dias < 30) {
    const semanas = Math.floor(dias / 7)
    return `hace ${semanas} ${semanas === 1 ? 'semana' : 'semanas'}`
  }
  if (dias < 365) {
    const meses = Math.floor(dias / 30)
    return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`
  }
  const anios = Math.floor(dias / 365)
  return `hace ${anios} ${anios === 1 ? 'año' : 'años'}`
}

/**
 * El ritmo con el que un canto vuelve: «cada 5 semanas».
 *
 * Devuelve null con una sola ejecución —no hay ritmo que promediar— para que la
 * pantalla pueda callarse en vez de inventar un «cada 0 días».
 */
export function describirEspaciado(dias: number | null): string | null {
  if (dias === null) return null
  if (dias < 7) return `cada ${dias} ${dias === 1 ? 'día' : 'días'}`
  // La semana llega más lejos acá que en `describirAntiguedad`, y es a propósito:
  // el coro canta los domingos, así que su ritmo se piensa en semanas. «Cada 5
  // semanas» dice cuántas misas pasan entre una vez y la otra; «cada mes», no.
  if (dias < 60) {
    const semanas = Math.round(dias / 7)
    return semanas === 1 ? 'cada semana' : `cada ${semanas} semanas`
  }
  const meses = Math.round(dias / 30)
  return meses === 1 ? 'cada mes' : `cada ${meses} meses`
}
