import { createClient } from '@/lib/supabase/server'
import { coincideBusqueda, normalizarBusqueda } from '@/lib/motores/busqueda'
import { normalizarEstado, type EstadoCanto } from '@/lib/motores/estado-canto'
import { TAMANO_POR_DEFECTO, esTamanoValido } from '@/lib/motores/tamano-letra'

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
 *
 * Los ARCHIVADOS no salen. El filtro va en la consulta y no al recorrer porque
 * el contador del pie lee esta misma lista: filtrando después habría un momento
 * en que el número y la lista no coinciden, y ese momento siempre termina
 * quedándose.
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
    .neq('estado', 'archivado')
    .order('titulo', { ascending: true })

  if (error) throw error

  const grupos = new Map<string, GrupoDeMomento>()

  for (const fila of (data ?? []) as unknown as FilaCanto[]) {
    const autor = fila.autores?.nombre ?? null
    if (!coincideBusqueda({ titulo: fila.titulo, autor, numero: fila.fuente_numero }, busqueda)) continue

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
 * Lo que vale para esta PERSONA en todo el repertorio: si quiere ver los
 * acordes (H11) y con qué tamaño de letra lee (2026-10-17, antes era por canto).
 *
 * Sin fila devuelve los defaults de las columnas —acordes sí, 16 px—, que es el
 * caso de todo el mundo hasta que cambia algo. Ese vacío es legítimo y no se
 * confunde con falta de acceso: la política es `perfil_id = auth.uid()`, así que
 * nadie ve la de otro.
 */
export type PreferenciasDelPerfil = { mostrarAcordes: boolean; tamanoLetra: number }

export async function preferenciasDelPerfil(): Promise<PreferenciasDelPerfil> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('preferencias_perfil')
    .select('mostrar_acordes, tamano_letra')
    .maybeSingle()

  return {
    mostrarAcordes: data?.mostrar_acordes ?? true,
    tamanoLetra: esTamanoValido(data?.tamano_letra) ? data.tamano_letra : TAMANO_POR_DEFECTO,
  }
}

export type CantoCompleto = {
  id: string
  titulo: string
  autor: string | null
  cifrado: string
  tonalidadOriginal: string | null
  /**
   * Con su id, no solo el nombre: H17 propone un canto PARA UN MOMENTO, y sin
   * el id la pantalla tendría que volver a buscar el momento por su texto.
   */
  momentos: { id: string; nombre: string }[]
  /** H10. El miembro lo ve para saber que el canto todavía se está sacando. */
  estado: EstadoCanto
  fuenteTitulo: string | null
  /** Número en el cancionero impreso: es como el coro los busca de memoria. */
  fuenteNumero: number | null
  fuentePagina: number | null
}

/**
 * La transposición PROPIA del usuario para un canto (H3).
 *
 * Es lo único que sigue siendo por canto: la voz no llega a ESE canto en ESE
 * tono. El tamaño de letra pasó a `preferenciasDelPerfil` el 2026-10-17, y la
 * columna `tamano_letra` de esta tabla quedó sin uso.
 *
 * Sin fila devuelve 0 (tonalidad original). Ese vacío es legítimo y no se
 * confunde con falta de acceso: nadie ve la preferencia de otro (PRD §8.2).
 */
export async function obtenerTransposicion(cantoId: string): Promise<number> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('preferencias_lectura')
    .select('transposicion')
    .eq('canto_id', cantoId)
    .maybeSingle()

  return data?.transposicion ?? 0
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
      'id, titulo, cifrado, tonalidad_original, estado, fuente_titulo, fuente_numero, fuente_pagina, autores(nombre), canto_momentos(momentos_liturgicos(id, nombre, orden))'
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
    canto_momentos: { momentos_liturgicos: { id: string; nombre: string; orden: number } | null }[]
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
      .filter((m): m is { id: string; nombre: string; orden: number } => m !== null)
      .sort((a, b) => a.orden - b.orden)
      .map((m) => ({ id: m.id, nombre: m.nombre })),
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

/**
 * Los cantos que el director sacó de circulación, del más reciente al más viejo.
 *
 * Vive aparte de `repertorioPorMomento` y sin agrupar por momento a propósito:
 * esto no es repertorio, es una papelera con vuelta atrás. Agruparla por
 * Entrada / Comunión la haría parecer una segunda lista del coro.
 */
export async function cantosArchivados(coroId: string): Promise<CantoDeLista[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cantos')
    .select('id, titulo, tonalidad_original, fuente_numero, estado, autores(nombre)')
    .eq('coro_id', coroId)
    .eq('estado', 'archivado')
    .order('updated_at', { ascending: false })

  if (error) throw error

  return (data ?? []).map((fila) => {
    const autor = fila.autores as unknown as { nombre: string } | null
    return {
      id: fila.id,
      titulo: fila.titulo,
      autor: autor?.nombre ?? null,
      tonalidadOriginal: fila.tonalidad_original,
      fuenteNumero: fila.fuente_numero,
      estado: normalizarEstado(fila.estado),
    }
  })
}

/**
 * En cuántas misas aparece este canto.
 *
 * Es el dato que la confirmación de archivar necesita para no ser una pregunta
 * vacía: «se cantó en 4 misas» es lo que hace que el director decida distinto
 * que ante «¿seguro?». Se cuenta al leer, nunca se guarda (innegociable 4).
 */
export async function vecesEnMisas(cantoId: string): Promise<number> {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('misa_cantos')
    .select('id', { count: 'exact', head: true })
    .eq('canto_id', cantoId)

  if (error) throw error
  return count ?? 0
}

/**
 * Cuántos cantos hay archivados en el coro.
 *
 * Cuenta con `head: true` —sin traer las filas— porque el pie del repertorio
 * solo necesita saber si ofrecer el enlace. Enlazar a una papelera vacía es
 * ruido en una pantalla que se mira de reojo.
 */
export async function contarArchivados(coroId: string): Promise<number> {
  const supabase = await createClient()

  const { count, error } = await supabase
    .from('cantos')
    .select('id', { count: 'exact', head: true })
    .eq('coro_id', coroId)
    .eq('estado', 'archivado')

  if (error) throw error
  return count ?? 0
}

export type CantoEncontrado = {
  id: string
  titulo: string
  autor: string | null
  fuenteNumero: number | null
  tonalidadOriginal: string | null
}

/**
 * La búsqueda de la cabecera, mientras se escribe (2026-10-17).
 *
 * Los mismos cantos y la misma regla que el repertorio (`coincideBusqueda`:
 * sin tildes, sin mayúsculas, y el número del cancionero exacto), pero una
 * lista plana y corta: es para encontrar uno y entrar, no para recorrer.
 * Primero los que EMPIEZAN con lo escrito, después los que lo contienen.
 */
export async function buscarCantos(coroId: string, termino: string, limite = 8): Promise<CantoEncontrado[]> {
  const aguja = normalizarBusqueda(termino)
  if (aguja === '') return []

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cantos')
    .select('id, titulo, tonalidad_original, fuente_numero, autores(nombre)')
    .eq('coro_id', coroId)
    .neq('estado', 'archivado')
    .order('titulo', { ascending: true })
  if (error) throw error

  type Fila = {
    id: string
    titulo: string
    tonalidad_original: string | null
    fuente_numero: number | null
    autores: { nombre: string } | null
  }
  const encontrados = ((data ?? []) as unknown as Fila[])
    .filter((f) =>
      coincideBusqueda({ titulo: f.titulo, autor: f.autores?.nombre, numero: f.fuente_numero }, termino)
    )
    .map((f) => ({
      id: f.id,
      titulo: f.titulo,
      autor: f.autores?.nombre ?? null,
      fuenteNumero: f.fuente_numero,
      tonalidadOriginal: f.tonalidad_original,
      empieza: normalizarBusqueda(f.titulo).startsWith(aguja) || String(f.fuente_numero) === aguja,
    }))

  return [...encontrados.filter((e) => e.empieza), ...encontrados.filter((e) => !e.empieza)]
    .slice(0, limite)
    .map((e) => ({
      id: e.id,
      titulo: e.titulo,
      autor: e.autor,
      fuenteNumero: e.fuenteNumero,
      tonalidadOriginal: e.tonalidadOriginal,
    }))
}
