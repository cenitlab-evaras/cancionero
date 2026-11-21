import { createClient } from '@/lib/supabase/server'
import { PARTES, type ParteDeLectura, type TipoDeLectura } from '@/lib/motores/lecturas'

/**
 * Lecturas guardadas de una misa — H30, docs/PRD.md §9.
 *
 * Mismo criterio que `misas.ts`: acá no se re-chequean permisos, la RLS de
 * `misa_lectura` decide qué filas salen. Lo que sí se hace acá es el orden:
 * PostgREST no sabe cuál es el orden litúrgico, así que se aplica al leer y no
 * se confía en cómo vino la consulta.
 */

/**
 * Una parte con la procedencia que se guarda junto al texto. Es lo que viaja
 * del importador al editor y del editor a la RPC.
 */
export type ParteParaGuardar = ParteDeLectura & {
  /** De dónde salió: la página pública de Iglesia.cl o la mano del director. */
  fuente: 'iglesia.cl' | 'manual'
  /** La URL exacta de la importación; `null` cuando se pegó a mano. */
  fuenteUrl: string | null
  /** Cuándo se trajo del sitio (ISO); `null` si nunca se importó. */
  traidoEn: string | null
}

/** Lo que devuelve la tabla al leer una misa: la misma forma que se guarda. */
export type LecturaGuardada = ParteParaGuardar

type FilaDeLectura = {
  misa_id: string
  tipo: string
  referencia: string
  texto: string
  fuente: string
  fuente_url: string | null
  traido_en: string | null
}

const COLUMNAS = 'misa_id, tipo, referencia, texto, fuente, fuente_url, traido_en'

/** La columna `tipo` tiene un check en la base; se verifica igual al leer. */
function esTipoDeLectura(valor: string): valor is TipoDeLectura {
  return (PARTES as readonly string[]).includes(valor)
}

function aLectura(fila: FilaDeLectura & { tipo: TipoDeLectura }): LecturaGuardada {
  return {
    tipo: fila.tipo,
    referencia: fila.referencia,
    texto: fila.texto,
    // Si llegara una fuente que no conocemos, se trata como manual: es peor
    // atribuirle a Iglesia.cl un texto que no vino de ahí.
    fuente: fila.fuente === 'iglesia.cl' ? 'iglesia.cl' : 'manual',
    fuenteUrl: fila.fuente_url,
    traidoEn: fila.traido_en,
  }
}

function enOrdenLiturgico(lecturas: LecturaGuardada[]): LecturaGuardada[] {
  return lecturas.sort((a, b) => PARTES.indexOf(a.tipo) - PARTES.indexOf(b.tipo))
}

/** Las partes de una misa, en el orden en que se leen. */
export async function lecturasDeMisa(misaId: string): Promise<LecturaGuardada[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('misa_lectura')
    .select(COLUMNAS)
    .eq('misa_id', misaId)

  if (error) throw error

  return enOrdenLiturgico(
    ((data ?? []) as FilaDeLectura[])
      .filter((fila): fila is FilaDeLectura & { tipo: TipoDeLectura } => esTipoDeLectura(fila.tipo))
      .map(aLectura)
  )
}

/**
 * Las partes de varias misas, agrupadas por misa.
 *
 * Sirve para las próximas misas: cada id pedido tiene su entrada, vacía si no
 * guardó lecturas, para que quien pinta la lista no tenga que distinguir entre
 * «no hay» y «no pregunté». Una sola consulta para todas.
 */
export async function lecturasDeVariasMis(
  ids: string[]
): Promise<Map<string, LecturaGuardada[]>> {
  const porMisa = new Map<string, LecturaGuardada[]>()
  for (const id of ids) porMisa.set(id, [])

  if (ids.length === 0) return porMisa

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('misa_lectura')
    .select(COLUMNAS)
    .in('misa_id', ids)

  if (error) throw error

  for (const fila of (data ?? []) as FilaDeLectura[]) {
    if (!esTipoDeLectura(fila.tipo)) continue
    const lista = porMisa.get(fila.misa_id)
    // Una fila de una misa que no se pidió no entra, aunque el `in` ya la acota.
    if (!lista) continue
    lista.push(aLectura(fila as FilaDeLectura & { tipo: TipoDeLectura }))
  }

  for (const lista of porMisa.values()) enOrdenLiturgico(lista)
  return porMisa
}
