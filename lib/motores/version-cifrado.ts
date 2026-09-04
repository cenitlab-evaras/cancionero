/**
 * Qué cambió entre dos versiones de un cifrado — H19-A · docs/PRD.md §9 y §18-13.
 *
 * Función PURA y sin datos. La base guarda el texto que había antes (tabla
 * `canto_version`, escrita por un trigger); esto responde la única pregunta que
 * el director se hace al mirar el historial: **¿qué me cambiaron?**
 *
 * POR QUÉ ESTO EXISTE Y NO ALCANZA CON MOSTRAR LOS DOS TEXTOS. El producto se
 * usa en un teléfono de 360 px, de pie, con la guitarra puesta (PRODUCT). Dos
 * cifrados de sesenta líneas uno al lado del otro no se comparan ahí ni con
 * tiempo. Si el historial no dice qué cambió, nadie lo abre, y un historial que
 * nadie abre no cumple lo que §18-13 pedía.
 *
 * LA DISTINCIÓN QUE MANDA es «tocaron los acordes» contra «tocaron la letra».
 * Corregir un acorde es la operación normal del coro —para eso existe todo
 * esto—; cambiar la letra es otra cosa, y merece verse distinto de reojo.
 */

/** Todo lo que esté entre corchetes: el mismo criterio que `acordesDeCanto` (RN-16). */
const ACORDE = /\[([^\]\n]+)\]/g

export type TipoLinea = 'igual' | 'quitada' | 'agregada'
export type LineaDiff = { tipo: TipoLinea; texto: string }

export type ResumenCambio = {
  /** El texto sin sus acordes es idéntico: solo se tocó el cifrado. */
  letraIntacta: boolean
  /** La secuencia de acordes es la misma, en el mismo orden. */
  acordesIguales: boolean
  acordesAntes: number
  acordesDespues: number
  lineasAgregadas: number
  lineasQuitadas: number
}

/** El cifrado sin sus acordes: lo que se canta. */
function soloLetra(cifrado: string): string {
  return cifrado.replace(ACORDE, '')
}

/** Los acordes en el orden en que aparecen, CON repetidos: acá la posición importa. */
function acordesEnOrden(cifrado: string): string[] {
  return [...cifrado.matchAll(ACORDE)].map(([, a]) => a!.trim())
}

/**
 * Las líneas de los dos textos alineadas por su subsecuencia común más larga.
 *
 * NO se compara por número de línea, y esa es la decisión del motor: insertar
 * una estrofa arriba correría todo el resto y marcaría el canto entero como
 * cambiado. La subsecuencia común encuentra las líneas que se conservaron
 * aunque hayan cambiado de lugar, que es lo que uno ve al mirar.
 *
 * Es O(n·m) en tiempo y memoria; un cifrado largo del cancionero tiene ~120
 * líneas, así que la matriz es de catorce mil enteros y se calcula sin que se
 * note.
 */
export function diffLineas(antes: string, despues: string): LineaDiff[] {
  const a = antes.split('\n')
  const b = despues.split('\n')

  // largo[i][j] = líneas en común entre a[i..] y b[j..]
  const largo: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0)
  )
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      largo[i]![j] = a[i] === b[j] ? largo[i + 1]![j + 1]! + 1 : Math.max(largo[i + 1]![j]!, largo[i]![j + 1]!)
    }
  }

  const salida: LineaDiff[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      salida.push({ tipo: 'igual', texto: a[i]! })
      i++
      j++
    } else if (largo[i + 1]![j]! >= largo[i]![j + 1]!) {
      salida.push({ tipo: 'quitada', texto: a[i]! })
      i++
    } else {
      salida.push({ tipo: 'agregada', texto: b[j]! })
      j++
    }
  }
  while (i < a.length) salida.push({ tipo: 'quitada', texto: a[i++]! })
  while (j < b.length) salida.push({ tipo: 'agregada', texto: b[j++]! })

  return salida
}

export function resumirCambio(antes: string, despues: string): ResumenCambio {
  const acordesA = acordesEnOrden(antes)
  const acordesD = acordesEnOrden(despues)
  const diff = diffLineas(antes, despues)

  return {
    letraIntacta: soloLetra(antes) === soloLetra(despues),
    acordesIguales:
      acordesA.length === acordesD.length && acordesA.every((x, k) => x === acordesD[k]),
    acordesAntes: acordesA.length,
    acordesDespues: acordesD.length,
    lineasAgregadas: diff.filter((l) => l.tipo === 'agregada').length,
    lineasQuitadas: diff.filter((l) => l.tipo === 'quitada').length,
  }
}

/**
 * El cambio en una frase, para la fila del historial.
 *
 * EL ORDEN DE LOS CASOS ES LA REGLA: si la letra cambió, eso es lo que se dice,
 * aunque además hayan cambiado los acordes. Es lo más grave y lo que uno
 * necesita ver sin desplegar nada.
 *
 * «Acordes corregidos» cubre también mover un acorde de sílaba —la corrección
 * más frecuente del coro—, donde no cambia ni la letra ni la cantidad.
 */
export function describirCambio(antes: string, despues: string): string {
  if (antes === despues) return 'Sin cambios'

  const r = resumirCambio(antes, despues)

  if (!r.letraIntacta) {
    return r.acordesIguales ? 'Cambió la letra' : 'Cambió la letra y los acordes'
  }

  const delta = r.acordesDespues - r.acordesAntes
  if (delta > 0) return `${delta} acorde${delta === 1 ? '' : 's'} agregado${delta === 1 ? '' : 's'}`
  if (delta < 0) {
    const n = -delta
    return `${n} acorde${n === 1 ? '' : 's'} quitado${n === 1 ? '' : 's'}`
  }
  return 'Acordes corregidos'
}

/** Una fila de `canto_version`: el cifrado que HABÍA antes de un cambio. */
export type VersionGuardada = {
  id: string
  cifrado: string
  reemplazadoEn: string
  /** Quién hizo el cambio. Nulo cuando el `update` no vino de una sesión. */
  quien: string | null
}

/** Un cambio del historial, con sus dos lados ya resueltos. */
export type Cambio = {
  id: string
  quien: string | null
  cuando: string
  antes: string
  despues: string
  descripcion: string
}

/**
 * El historial legible, del cambio más reciente al más viejo.
 *
 * LA PIEZA QUE HAY QUE MIRAR DOS VECES: una fila guardada dice qué había ANTES,
 * pero no qué vino después. El «después» de la fila más reciente es el cifrado
 * actual del canto; el de cualquier otra es el cifrado de la fila que la
 * reemplazó — es decir, la de arriba en esta lista.
 *
 * Armarlo al revés mostraría cada corrección invertida («quitó el acorde»
 * cuando lo agregó) y nadie lo notaría hasta usar el historial para decidir.
 *
 * `versiones` llega ordenada de la más reciente a la más vieja, que es como la
 * pide la capa de datos y como se lee en pantalla.
 */
export function armarHistorial(versiones: VersionGuardada[], cifradoActual: string): Cambio[] {
  return versiones.map((version, i) => {
    const despues = i === 0 ? cifradoActual : versiones[i - 1]!.cifrado
    return {
      id: version.id,
      quien: version.quien,
      cuando: version.reemplazadoEn,
      antes: version.cifrado,
      despues,
      descripcion: describirCambio(version.cifrado, despues),
    }
  })
}
