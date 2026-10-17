import { createClient } from '@/lib/supabase/server'
import { esCuerda, ordenarCuerdas, type Cuerda } from '@/lib/motores/cuerdas'

/**
 * H23 · La partitura de un canto y lo que hace falta para ensayarla.
 *
 * Todo con la sesión del usuario: la RLS de `partitura` decide si la fila sale
 * (publicada, o borrador para el director), y la de `storage.objects` decide si
 * se puede firmar cada archivo. Ninguna de las dos cosas se decide acá.
 */

const SONIDOS = ['voces', 'piano', 'organo', 'guitarra', 'flauta'] as const
export type Sonido = (typeof SONIDOS)[number]

/** Una hora: lo que dura un ensayo largo. La URL vencida ya no abre nada (§21.4). */
const VIGENCIA_S = 60 * 60

export type PartituraPublicada = {
  id: string
  cantoId: string
  coroId: string
  huella: string
}

/** La publicada del canto, si esta persona puede verla. `null` = no hay pestaña. */
export async function partituraPublicada(cantoId: string): Promise<PartituraPublicada | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('partitura')
    .select('id, canto_id, coro_id, huella')
    .eq('canto_id', cantoId)
    .eq('estado', 'publicada')
    .maybeSingle()

  return data
    ? { id: data.id, cantoId: data.canto_id, coroId: data.coro_id, huella: data.huella }
    : null
}

export type MaterialDeEnsayo = {
  /** ♩ escrito en la partitura: el de las pistas. */
  tempo: number
  duracionMs: number
  /** La cuerda de cada pentagrama, en el orden del dibujo: la sincronía los nombra por índice. */
  pentagramas: Cuerda[]
  /** Las mismas, de agudo a grave y después las estrofas. */
  cuerdas: Cuerda[]
  sonidos: Sonido[]
  /** La partitura dibujada con su sincronía (≈ 1 MB): la baja el navegador. */
  urlPartitura: string
  pistas: Record<Sonido, Record<Cuerda, string>>
}

type Manifiesto = {
  version: number
  tempo: number
  duracionMs: number
  pentagramas: string[]
  sonidos: string[]
}

/**
 * El manifiesto y las URLs firmadas de una partitura publicada.
 *
 * Devuelve `null` si cualquier archivo no se pudo firmar: la RLS de Storage
 * dijo que no, o falta algo. Una pantalla a medias —siete pistas y una muda—
 * sería peor que decir «no tienes acceso».
 */
export async function materialDeEnsayo(p: PartituraPublicada): Promise<MaterialDeEnsayo | null> {
  const supabase = await createClient()
  const bucket = supabase.storage.from('partituras')
  const base = `${p.coroId}/${p.cantoId}/${p.huella}`

  const { data: archivo, error } = await bucket.download(`${base}/manifiesto.json`)
  if (error || !archivo) return null

  let m: Manifiesto
  try {
    m = JSON.parse(await archivo.text())
  } catch {
    return null
  }

  const pentagramas = m.pentagramas.filter(esCuerda)
  const sonidos = m.sonidos.filter((s): s is Sonido => (SONIDOS as readonly string[]).includes(s))
  if (pentagramas.length !== m.pentagramas.length || sonidos.length === 0) return null

  const rutas = [
    `${base}/partitura.json`,
    ...sonidos.flatMap((s) => pentagramas.map((c) => `${base}/pistas/${s}/${c}.mp3`)),
  ]
  const { data: firmadas, error: errorFirma } = await bucket.createSignedUrls(rutas, VIGENCIA_S)
  if (errorFirma || !firmadas || firmadas.some((f) => !f.signedUrl || f.error)) return null

  const url = new Map(firmadas.map((f) => [f.path, f.signedUrl]))
  const pistas = Object.fromEntries(
    sonidos.map((s) => [
      s,
      Object.fromEntries(pentagramas.map((c) => [c, url.get(`${base}/pistas/${s}/${c}.mp3`)!])),
    ])
  ) as Record<Sonido, Record<Cuerda, string>>

  return {
    tempo: m.tempo,
    duracionMs: m.duracionMs,
    pentagramas,
    cuerdas: ordenarCuerdas(pentagramas),
    sonidos,
    urlPartitura: url.get(`${base}/partitura.json`)!,
    pistas,
  }
}

/**
 * Los cantos que esta persona puede ensayar: los que tienen partitura
 * PUBLICADA, que es la que abre «Ensayar» (un borrador no). Para marcarlos en
 * el repertorio: antes había que entrar canto por canto para descubrirlos.
 */
export async function cantosConPartitura(): Promise<Set<string>> {
  const supabase = await createClient()
  const { data } = await supabase.from('partitura').select('canto_id').eq('estado', 'publicada')
  return new Set((data ?? []).map((p) => p.canto_id as string))
}
