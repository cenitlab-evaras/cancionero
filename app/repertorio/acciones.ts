'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { validarCanto, type Campo } from '@/lib/motores/validar-canto'
import { ESTADOS_EDITABLES, normalizarEstado } from '@/lib/motores/estado-canto'
import { ordenarMomento, soltarCanto } from '@/lib/motores/orden-en-el-momento'

/**
 * Alta y edición del repertorio (H8).
 *
 * Valida con el MISMO motor que la pantalla, así el mensaje que se ve y la
 * regla que se aplica son el mismo texto. Y comprueba el rol en el servidor
 * además de la RLS (§8.3): sin eso, la RLS rechaza afectando cero filas y el
 * usuario cree que guardó.
 */

export type ResultadoCanto =
  | { ok: true; cantoId: string }
  | { ok: false; error?: string; errores?: Partial<Record<Campo, string>> }

const Entrada = z.object({
  titulo: z.string(),
  cifrado: z.string(),
  autorNombre: z.string().optional(),
  tonalidadOriginal: z.string().optional(),
  momentoIds: z.array(z.string().uuid()).min(1, 'Elige al menos un momento.'),
  // H10. Opcional para que un cliente viejo —o un POST armado a mano— no rompa
  // el alta: sin estado, la columna aplica su default (`listo`).
  estado: z.enum(ESTADOS_EDITABLES).optional(),
  fuenteTitulo: z.string().optional(),
  fuenteNumero: z.number().int().nullable().optional(),
  fuentePagina: z.number().int().nullable().optional(),
})

const NO_PUEDE = 'No tienes permiso para editar el repertorio de este coro.'

/**
 * Encuentra el autor por nombre, o lo da de alta.
 *
 * Desde H8 el director puede insertar en `autores` (no editar ni borrar): sin
 * eso, cargar un canto de un autor que no está en el catálogo se traba hasta
 * que un admin intervenga. El catálogo sigue siendo global (decisión 6).
 */
async function resolverAutor(nombre: string | undefined): Promise<string | null> {
  const limpio = nombre?.trim()
  if (!limpio) return null

  const supabase = await createClient()

  const { data: existente } = await supabase
    .from('autores')
    .select('id')
    .ilike('nombre', limpio)
    .maybeSingle()
  if (existente) return existente.id

  const { data, error } = await supabase.from('autores').insert({ nombre: limpio }).select('id').single()
  if (error) return null
  return data.id
}

async function guardar(raw: unknown, cantoId: string | null): Promise<ResultadoCanto> {
  const parseado = Entrada.safeParse(raw)
  if (!parseado.success) {
    return { ok: false, error: parseado.error.issues[0]?.message ?? 'Revisa los datos.' }
  }
  const datos = parseado.data

  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Tu sesión expiró. Vuelve a entrar.' }
  if (!sesion.coroActivo) return { ok: false, error: 'No tienes un coro activo.' }
  if (!puede(sesion.sujeto, 'editar_canto')) return { ok: false, error: NO_PUEDE }

  // RN-01, con mensaje por campo. La misma llamada que hace el formulario.
  const validacion = validarCanto({
    titulo: datos.titulo,
    cifrado: datos.cifrado,
    tonalidadOriginal: datos.tonalidadOriginal,
    fuenteNumero: datos.fuenteNumero ?? null,
    fuentePagina: datos.fuentePagina ?? null,
  })
  if (!validacion.ok) return { ok: false, errores: validacion.errores }

  const supabase = await createClient()
  const autorId = await resolverAutor(datos.autorNombre)

  const fila = {
    coro_id: sesion.coroActivo.id,
    titulo: validacion.limpio.titulo,
    cifrado: validacion.limpio.cifrado,
    autor_id: autorId,
    tonalidad_original: validacion.limpio.tonalidadOriginal,
    // H10. Si no vino, se OMITE la clave en vez de mandar el default: en un
    // update, escribir 'listo' porque el formulario no lo trajo sacaría de
    // ensayo un canto que nadie tocó.
    ...(datos.estado ? { estado: normalizarEstado(datos.estado) } : {}),
    fuente_titulo: datos.fuenteTitulo?.trim() || null,
    fuente_numero: datos.fuenteNumero ?? null,
    fuente_pagina: datos.fuentePagina ?? null,
    updated_at: new Date().toISOString(),
  }

  let id: string
  if (cantoId) {
    const { data, error } = await supabase
      .from('cantos')
      .update(fila)
      .eq('id', cantoId)
      .select('id')
      .maybeSingle()

    if (error) return { ok: false, ...traducir(error) }
    // Cero filas y sin error es la RLS diciendo que no. No se deja pasar como
    // un guardado exitoso (§14).
    if (!data) return { ok: false, error: NO_PUEDE }
    id = data.id
  } else {
    const { data, error } = await supabase.from('cantos').insert(fila).select('id').single()
    if (error || !data) return { ok: false, ...traducir(error) }
    id = data.id
  }

  // Los momentos se reescriben enteros: son pocos y así no hay que calcular
  // qué se agregó y qué se quitó. `coro_id` va denormalizado (§7). El lugar
  // que el canto tenía en cada momento que conserva se guarda antes y se le
  // devuelve (2026-10-17): si no, editar un canto lo mandaba al final.
  const { data: antes } = await supabase
    .from('canto_momentos')
    .select('momento_id, orden')
    .eq('canto_id', id)
  const lugar = new Map(
    (antes ?? []).map((v) => [v.momento_id as string, v.orden as number | null])
  )
  await supabase.from('canto_momentos').delete().eq('canto_id', id)
  const { error: errMomentos } = await supabase.from('canto_momentos').insert(
    datos.momentoIds.map((momentoId) => ({
      canto_id: id,
      momento_id: momentoId,
      coro_id: sesion.coroActivo!.id,
      orden: lugar.get(momentoId) ?? null,
    }))
  )
  if (errMomentos) return { ok: false, error: 'El canto se guardó, pero no sus momentos.' }

  revalidatePath('/repertorio')
  revalidatePath(`/repertorio/${id}`)
  return { ok: true, cantoId: id }
}

/** Traduce el error de Postgres a algo que se pueda leer y accionar. */
function traducir(error: { code?: string } | null): { error?: string; errores?: Partial<Record<Campo, string>> } {
  if (error?.code === '23505') {
    return {
      errores: {
        titulo:
          'Ya tienes un canto con ese título y ese autor. Si es otra versión, cámbiale el autor o distínguela en el título.',
      },
    }
  }
  return { error: 'No pudimos guardar el canto.' }
}

export async function crearCanto(raw: unknown): Promise<ResultadoCanto> {
  const r = await guardar(raw, null)
  if (r.ok) redirect(`/repertorio/${r.cantoId}`)
  return r
}

export async function editarCanto(cantoId: string, raw: unknown): Promise<ResultadoCanto> {
  const id = z.string().uuid().safeParse(cantoId)
  if (!id.success) return { ok: false, error: 'Ese canto no existe.' }

  const r = await guardar(raw, id.data)
  if (r.ok) redirect(`/repertorio/${r.cantoId}`)
  return r
}

/**
 * Archivar y desarchivar (§16, la fila del borrado, cerrada el 2026-09-03).
 *
 * NO borra. `misa_cantos` cae en cascada, así que un `delete` real se llevaría
 * el canto de las misas pasadas donde se cantó y el historial de H13 perdería
 * esas veces en silencio. Acá solo cambia `estado`, que es el mismo `update`
 * que ya hacía H10 — la RLS (`cantos_write` = `es_director_de`) y el `check` de
 * la columna son los mismos de siempre.
 *
 * Desarchivar devuelve el canto a `listo` y no al estado que tenía antes: el
 * anterior no se guarda en ninguna parte, e inventar que era `en_ensayo`
 * pondría al coro a ensayar algo que nadie pidió.
 */
export type ResultadoArchivo = { ok: true } | { ok: false; error: string }

const NO_PUEDE_ARCHIVAR = 'No tienes permiso para archivar cantos de este coro.'

async function cambiarEstadoDeArchivo(
  cantoId: string,
  nuevo: 'archivado' | 'listo'
): Promise<ResultadoArchivo> {
  const id = z.string().uuid().safeParse(cantoId)
  if (!id.success) return { ok: false, error: 'Ese canto no existe.' }

  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Sesión expirada. Vuelve a entrar.' }
  if (!sesion.coroActivo) return { ok: false, error: 'No perteneces a ningún coro.' }
  if (!puede(sesion.sujeto, 'archivar_canto')) return { ok: false, error: NO_PUEDE_ARCHIVAR }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('cantos')
    .update({ estado: nuevo, updated_at: new Date().toISOString() })
    .eq('id', id.data)
    .select('id')
    .maybeSingle()

  if (error) return { ok: false, error: 'No pudimos guardar el cambio.' }
  // Cero filas sin error es la RLS diciendo que no (§14): no se deja pasar
  // como un guardado exitoso.
  if (!data) return { ok: false, error: NO_PUEDE_ARCHIVAR }

  revalidatePath('/repertorio')
  revalidatePath('/repertorio/archivados')
  revalidatePath(`/repertorio/${id.data}`)
  return { ok: true }
}

export async function archivarCanto(cantoId: string): Promise<ResultadoArchivo> {
  return cambiarEstadoDeArchivo(cantoId, 'archivado')
}

export async function desarchivarCanto(cantoId: string): Promise<ResultadoArchivo> {
  return cambiarEstadoDeArchivo(cantoId, 'listo')
}

/**
 * El director suelta un canto que arrastró con el dedo o el mouse (el dueño,
 * 2026-10-17: «el clásico mover con el dedo o mouse. Y se puede cambiar de
 * sección de la misa también»). `indice` es su lugar en el momento destino,
 * contado sin él. Las listas se rearman con el MISMO motor que usa la pantalla
 * (`soltarCanto`), así lo que se ve al soltar es lo que queda guardado.
 *
 * Se reescribe el lugar de TODOS los cantos visibles de los momentos tocados
 * (0, 1, 2…): lo que nunca se había ordenado queda fijo donde se veía, y no
 * salta al final cuando el de al lado pasa a tener número. Los archivados no
 * cuentan.
 *
 * Cambiar de momento es cambiar el `momento_id` del vínculo; si el canto ya
 * estaba también en el destino, el vínculo del origen se borra y queda el que
 * ya había (unique canto–momento). La RLS (`canto_momentos_write`) vuelve a
 * decidir en cada escritura.
 */
export type ResultadoSoltar = { ok: true } | { ok: false; error: string }

const Soltar = z.object({
  cantoId: z.string().uuid(),
  de: z.string().min(1),
  a: z.string().min(1),
  indice: z.number().int().min(0),
})

const NO_PUEDE_ORDENAR = 'No tienes permiso para ordenar el repertorio de este coro.'
const NO_SE_GUARDO = 'No pudimos guardar el orden. Vuelve a intentarlo.'

export async function soltarEnElRepertorio(raw: unknown): Promise<ResultadoSoltar> {
  const parseado = Soltar.safeParse(raw)
  if (!parseado.success) return { ok: false, error: 'No entendimos a dónde soltaste el canto.' }
  const datos = parseado.data

  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Tu sesión expiró. Vuelve a entrar.' }
  if (!sesion.coroActivo) return { ok: false, error: 'No tienes un coro activo.' }
  if (!puede(sesion.sujeto, 'editar_canto')) return { ok: false, error: NO_PUEDE_ORDENAR }
  const coroId = sesion.coroActivo.id

  const supabase = await createClient()
  const { data: momentos } = await supabase
    .from('momentos_liturgicos')
    .select('id, codigo')
    .in('codigo', [...new Set([datos.de, datos.a])])
  const idDe = momentos?.find((m) => m.codigo === datos.de)?.id as string | undefined
  const idA = momentos?.find((m) => m.codigo === datos.a)?.id as string | undefined
  if (!idDe || !idA) return { ok: false, error: 'Ese momento no existe.' }

  const { data: vinculos, error: errLeer } = await supabase
    .from('canto_momentos')
    .select('id, canto_id, momento_id, orden, cantos(titulo, estado)')
    .eq('coro_id', coroId)
    .in('momento_id', [...new Set([idDe, idA])])
  if (errLeer) return { ok: false, error: NO_SE_GUARDO }

  type Vinculo = { id: string; cantoId: string; momentoId: string; orden: number | null; titulo: string }
  const visibles: Vinculo[] = (vinculos ?? []).flatMap((v) => {
    const canto = v.cantos as unknown as { titulo: string; estado: string } | null
    if (!canto || canto.estado === 'archivado') return []
    return [
      {
        id: v.id as string,
        cantoId: v.canto_id as string,
        momentoId: v.momento_id as string,
        orden: v.orden as number | null,
        titulo: canto.titulo,
      },
    ]
  })
  const delMomento = (momentoId: string) => ordenarMomento(visibles.filter((v) => v.momentoId === momentoId))
  const enDe = delMomento(idDe)
  const enA = delMomento(idA)

  const movido = enDe.find((v) => v.cantoId === datos.cantoId)
  if (!movido) return { ok: false, error: 'Ese canto ya no está en ese momento. Recarga la página.' }

  const listas = soltarCanto(
    { [datos.de]: enDe.map((v) => v.cantoId), [datos.a]: enA.map((v) => v.cantoId) },
    { id: datos.cantoId, de: datos.de, a: datos.a, indice: datos.indice }
  )

  // El vínculo de cada canto en el destino, con el lugar que tiene hoy. El
  // movido entra con el suyo propio, o con el que ya tenía en el destino.
  const enDestino = new Map(enA.map((v) => [v.cantoId, { id: v.id, orden: v.orden }]))

  if (datos.de !== datos.a) {
    const yaEstaba = enDestino.has(datos.cantoId)
    const { data: cambiado, error } = yaEstaba
      ? await supabase.from('canto_momentos').delete().eq('id', movido.id).select('id')
      : await supabase.from('canto_momentos').update({ momento_id: idA }).eq('id', movido.id).select('id')
    if (error) return { ok: false, error: NO_SE_GUARDO }
    // Cero filas sin error es la RLS diciendo que no (§14).
    if (!cambiado?.length) return { ok: false, error: NO_PUEDE_ORDENAR }
    // Lo que traía del origen no vale en el destino: se escribe siempre.
    if (!yaEstaba) enDestino.set(datos.cantoId, { id: movido.id, orden: null })
  }

  const enOrigen = new Map(enDe.map((v) => [v.cantoId, { id: v.id, orden: v.orden }]))
  const cambios = [
    ...listas[datos.a].map((cantoId, i) => ({ vinculo: enDestino.get(cantoId)!, orden: i })),
    ...(datos.de === datos.a
      ? []
      : listas[datos.de].map((cantoId, i) => ({ vinculo: enOrigen.get(cantoId)!, orden: i }))),
  ].filter((c) => c.vinculo.orden !== c.orden)

  const resultados = await Promise.all(
    cambios.map((c) =>
      supabase.from('canto_momentos').update({ orden: c.orden }).eq('id', c.vinculo.id).select('id')
    )
  )
  if (resultados.some((r) => r.error)) return { ok: false, error: NO_SE_GUARDO }
  if (resultados.some((r) => !r.data?.length)) return { ok: false, error: NO_PUEDE_ORDENAR }

  revalidatePath('/repertorio')
  // La ficha del canto lista sus momentos: si cambió de momento, también.
  if (datos.de !== datos.a) revalidatePath(`/repertorio/${datos.cantoId}`)
  return { ok: true }
}
