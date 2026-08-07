import { createClient } from '@/lib/supabase/server'
import { coincideBusqueda } from '@/lib/motores/busqueda'
import { normalizarEstado, type EstadoCanto } from '@/lib/motores/estado-canto'

/**
 * Consultas del repertorio.
 *
 * NO se re-chequean permisos antes del query: la RLS decide qué filas salen. Si
 * el usuario no tiene alcance sobre el coro, `data` viene vacío y eso es
 * correcto — pero la RUTA sí tiene que distinguir vacío de sin-acceso
 * (PRD §14), y para eso está `puedeVerCoro`.
 */

export type CantoDeLista = {
  id: string
  titulo: string
  autor: string | null
  tonalidadOriginal: string | null
  /** Número en el cancionero impreso: es como el coro los busca de memoria. */
  fuenteNumero: number | null
  /** H10. Se normaliza al leer: la pantalla nunca ve un valor crudo de la base. */
  estado: EstadoCanto
}

export type GrupoDeMomento = {
  codigo: string
  nombre: string
  orden: number
  cantos: CantoDeLista[]
}

type FilaCanto = {
  id: string
  titulo: string
  tonalidad_original: string | null
  fuente_numero: number | null
  estado: string
  autores: { nombre: string } | null
  canto_momentos: { momentos_liturgicos: { codigo: string; nombre: string; orden: number } | null }[]
}

/**
 * El repertorio de un coro, agrupado por momento litúrgico y filtrado por el
 * término de búsqueda (RF-02). El filtrado usa el motor puro, no `ilike`:
 * ignorar acentos es una regla del producto, no del motor de base de datos.
 *
 * Un momento sin cantos no se devuelve: no se dibuja un grupo vacío (PRD §14).
 */
export async function repertorioPorMomento(
  coroId: string,
  busqueda = ''
): Promise<GrupoDeMomento[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cantos')
    .select(
      'id, titulo, tonalidad_original, fuente_numero, estado, autores(nombre), canto_momentos(momentos_liturgicos(codigo, nombre, orden))'
    )
    .eq('coro_id', coroId)
    .order('titulo', { ascending: true })

  if (error) throw error

  const grupos = new Map<string, GrupoDeMomento>()

  for (const fila of (data ?? []) as unknown as FilaCanto[]) {
    const autor = fila.autores?.nombre ?? null
    if (!coincideBusqueda({ titulo: fila.titulo, autor }, busqueda)) continue

    const canto: CantoDeLista = {
      id: fila.id,
      titulo: fila.titulo,
      autor,
      tonalidadOriginal: fila.tonalidad_original,
      fuenteNumero: fila.fuente_numero,
      estado: normalizarEstado(fila.estado),
    }

    for (const vinculo of fila.canto_momentos) {
      const momento = vinculo.momentos_liturgicos
      if (!momento) continue
      const grupo = grupos.get(momento.codigo) ?? {
        codigo: momento.codigo,
        nombre: momento.nombre,
        orden: momento.orden,
        cantos: [],
      }
      grupo.cantos.push(canto)
      grupos.set(momento.codigo, grupo)
    }
  }

  return [...grupos.values()].sort((a, b) => a.orden - b.orden)
}

/**
 * ¿Esta persona quiere ver los acordes? (H11)
 *
 * Sin fila devuelve `true`, que es el default de la columna y la lectura normal
 * del producto: un cancionero con acordes. Ese vacío es legítimo —es el caso de
 * todo el mundo hasta que alguien los apaga— y no se confunde con falta de
 * acceso: la política es `perfil_id = auth.uid()`, así que nadie ve la de otro.
 */
export async function mostrarAcordesDelPerfil(): Promise<boolean> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('preferencias_perfil')
    .select('mostrar_acordes')
    .maybeSingle()

  return data?.mostrar_acordes ?? true
}

export type CantoCompleto = {
  id: string
  titulo: string
  autor: string | null
  cifrado: string
  tonalidadOriginal: string | null
  momentos: string[]
  /** H10. El músico lo ve para saber que el canto todavía se está sacando. */
  estado: EstadoCanto
  fuenteTitulo: string | null
  /** Número en el cancionero impreso: es como el coro los busca de memoria. */
  fuenteNumero: number | null
  fuentePagina: number | null
}

/** Valores por defecto cuando el usuario todavía no guardó preferencia. */
export const PREFERENCIA_POR_DEFECTO = { transposicion: 0, tamanoLetra: 16 }

export type PreferenciaLectura = { transposicion: number; tamanoLetra: number }

/**
 * La preferencia PROPIA del usuario para un canto.
 *
 * Si no hay fila, devuelve los valores por defecto. Ese vacío es legítimo —es
 * el caso normal la primera vez— y no se confunde con falta de acceso: la
 * política de esta tabla es `perfil_id = auth.uid()`, así que nadie ve la de
 * otro, ni el director ni el admin (PRD §8.2).
 */
export async function obtenerPreferencia(cantoId: string): Promise<PreferenciaLectura> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('preferencias_lectura')
    .select('transposicion, tamano_letra')
    .eq('canto_id', cantoId)
    .maybeSingle()

  if (!data) return PREFERENCIA_POR_DEFECTO
  return { transposicion: data.transposicion, tamanoLetra: data.tamano_letra }
}

/**
 * Un canto por su id, o null si la RLS no lo dejó pasar.
 *
 * CERO FILAS NO ES UN ESTADO VACÍO: quien llame a esto tiene que distinguir
 * "no existe" de "no tenés acceso" (PRD §14). Por eso devuelve null y la ruta
 * decide el mensaje, en vez de dibujar una pantalla en blanco.
 */
export async function obtenerCanto(cantoId: string): Promise<CantoCompleto | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cantos')
    .select(
      'id, titulo, cifrado, tonalidad_original, estado, fuente_titulo, fuente_numero, fuente_pagina, autores(nombre), canto_momentos(momentos_liturgicos(nombre, orden))'
    )
    .eq('id', cantoId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  type FilaCantoCompleto = {
    id: string
    titulo: string
    cifrado: string
    tonalidad_original: string | null
    estado: string
    fuente_titulo: string | null
    fuente_numero: number | null
    fuente_pagina: number | null
    autores: { nombre: string } | null
    canto_momentos: { momentos_liturgicos: { nombre: string; orden: number } | null }[]
  }

  const fila = data as unknown as FilaCantoCompleto

  return {
    id: fila.id,
    titulo: fila.titulo,
    autor: fila.autores?.nombre ?? null,
    cifrado: fila.cifrado,
    tonalidadOriginal: fila.tonalidad_original,
    estado: normalizarEstado(fila.estado),
    momentos: fila.canto_momentos
      .map((v) => v.momentos_liturgicos)
      .filter((m): m is { nombre: string; orden: number } => m !== null)
      .sort((a, b) => a.orden - b.orden)
      .map((m) => m.nombre),
    fuenteTitulo: fila.fuente_titulo,
    fuenteNumero: fila.fuente_numero,
    fuentePagina: fila.fuente_pagina,
  }
}

/**
 * El catálogo de momentos y los autores que ya existen (H8).
 *
 * Los momentos alimentan el selector del formulario; los autores, la sugerencia
 * del campo de autor — para no ensuciar el catálogo global con variantes del
 * mismo nombre («Gabaráin» y «Cesáreo Gabaráin» serían dos).
 */
export async function catalogosParaEditar(): Promise<{
  momentos: { id: string; nombre: string; orden: number }[]
  autores: string[]
}> {
  const supabase = await createClient()

  const [{ data: momentos, error: e1 }, { data: autores, error: e2 }] = await Promise.all([
    supabase.from('momentos_liturgicos').select('id, nombre, orden').order('orden'),
    supabase.from('autores').select('nombre').order('nombre'),
  ])

  if (e1) throw e1
  if (e2) throw e2

  return {
    momentos: momentos ?? [],
    autores: (autores ?? []).map((a) => a.nombre as string),
  }
}

/** Un canto con lo que hace falta para volver a editarlo. */
export async function cantoParaEditar(cantoId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cantos')
    .select(
      'id, titulo, cifrado, tonalidad_original, estado, fuente_titulo, fuente_numero, fuente_pagina, autores(nombre), canto_momentos(momento_id)'
    )
    .eq('id', cantoId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const autor = data.autores as unknown as { nombre: string } | null
  const momentos = (data.canto_momentos ?? []) as unknown as { momento_id: string }[]

  return {
    id: data.id,
    titulo: data.titulo,
    autorNombre: autor?.nombre ?? '',
    cifrado: data.cifrado,
    tonalidadOriginal: data.tonalidad_original ?? '',
    estado: normalizarEstado(data.estado),
    momentoIds: momentos.map((m) => m.momento_id),
    fuenteTitulo: data.fuente_titulo ?? '',
    fuenteNumero: data.fuente_numero ? String(data.fuente_numero) : '',
    fuentePagina: data.fuente_pagina ? String(data.fuente_pagina) : '',
  }
}
