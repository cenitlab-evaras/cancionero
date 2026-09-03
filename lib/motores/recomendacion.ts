import { estaArchivado, type EstadoCanto } from './estado-canto'

/**
 * Qué conviene volver a cantar — H18, docs/PRD.md §17 y §19.2-B1-C.
 *
 * Función PURA y sin datos: la usa el armador de la misa para ordenar los
 * cantos de cada momento por lo que hace falta rotar.
 *
 * DETERMINISTA Y EXPLICABLE EN UNA FRASE, por §10: «primero el que hace más
 * tiempo que no se canta». No hay puntaje compuesto ni pesos que ajustar. Si el
 * director no puede decir por qué un canto está primero, no lo va a usar para
 * decidir — y una recomendación que no se usa es peso muerto en la pantalla.
 *
 * POR QUÉ NO MEZCLA CON EL RANKING DE H17. §18-12 anticipó que el historial y
 * las sugerencias dan consejos opuestos: uno empuja a rotar, el otro a repetir.
 * El dueño decidió el 2026-09-03 que **manda rotar**, y las sugerencias siguen
 * viéndose en su propio bloque, al lado. No se combinan en un puntaje: sumar
 * «hace ocho meses» con «lo piden tres» da un número que no significa ninguna
 * de las dos cosas.
 */

export type Candidato = {
  cantoId: string
  titulo: string
  estado: EstadoCanto
  /** `YYYY-MM-DD` de la última vez que se cantó, o `null` si nunca. */
  ultima: string | null
}

export type Recomendado = Candidato & { diasDesdeUltima: number }

export type Recomendacion = {
  /** Cantados alguna vez, del más olvidado al más reciente. */
  hacenFalta: Recomendado[]
  /** Nunca cantados. Aparte, porque es otro consejo. */
  nuncaCantados: Candidato[]
}

const MS_POR_DIA = 86_400_000

function diasEntre(desde: string, hasta: string): number {
  const a = Date.parse(`${desde}T00:00:00Z`)
  const b = Date.parse(`${hasta}T00:00:00Z`)
  return Math.round((b - a) / MS_POR_DIA)
}

/**
 * DOS GRUPOS Y NO UNO, y esta es la decisión de diseño del hito.
 *
 * «Hace ocho meses que no cantan este» y «este no lo cantaron nunca» son
 * consejos distintos y quien los recibe hace cosas distintas con cada uno. Si
 * «nunca» se tratara como «hace infinito tiempo», los 74 cantos que entraron
 * por el importador coparían el tope de cada momento y enterrarían justo lo que
 * el director NO puede calcular de memoria — que es la razón por la que existe
 * el historial de H13.
 *
 * Es el mismo corte que ya hace `/historial`, donde los nunca cantados se dicen
 * en su propio bloque en vez de quedar como un `0` perdido al final.
 */
export function recomendar(candidatos: Candidato[], hoy: string): Recomendacion {
  const hacenFalta: Recomendado[] = []
  const nuncaCantados: Candidato[] = []

  for (const c of candidatos) {
    // Un archivado salió de circulación (§16). Recomendarlo sería devolverlo
    // por la ventana, sin pasar por la pantalla que dice que está volviendo.
    if (estaArchivado(c.estado)) continue

    if (c.ultima === null) nuncaCantados.push(c)
    else hacenFalta.push({ ...c, diasDesdeUltima: diasEntre(c.ultima, hoy) })
  }

  // El desempate alfabético no es cosmético: sin él, dos cantos con la misma
  // antigüedad se ordenarían según cómo vino la consulta, y el director vería
  // un orden distinto en cada recarga sin que nada hubiera cambiado.
  hacenFalta.sort(
    (a, b) =>
      b.diasDesdeUltima - a.diasDesdeUltima || a.titulo.localeCompare(b.titulo, 'es')
  )

  // Entre los que nunca sonaron, primero los que el coro ya da por listos: uno
  // marcado `listo` está más cerca de poder cantarse que uno todavía en ensayo.
  nuncaCantados.sort(
    (a, b) =>
      Number(a.estado === 'en_ensayo') - Number(b.estado === 'en_ensayo') ||
      a.titulo.localeCompare(b.titulo, 'es')
  )

  return { hacenFalta, nuncaCantados }
}
