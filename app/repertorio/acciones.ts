'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { validarCanto, type Campo } from '@/lib/motores/validar-canto'
import { ESTADOS_EDITABLES, normalizarEstado } from '@/lib/motores/estado-canto'

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
  if (!sesion) return { ok: false, error: 'Sesión expirada. Volvé a entrar.' }
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
  // qué se agregó y qué se quitó. `coro_id` va denormalizado (§7).
  await supabase.from('canto_momentos').delete().eq('canto_id', id)
  const { error: errMomentos } = await supabase.from('canto_momentos').insert(
    datos.momentoIds.map((momentoId) => ({
      canto_id: id,
      momento_id: momentoId,
      coro_id: sesion.coroActivo!.id,
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
