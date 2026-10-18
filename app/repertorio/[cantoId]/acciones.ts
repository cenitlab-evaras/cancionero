'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { normalizarSemitonos, transponer, transponerAcorde } from '@/lib/motores/transponer'
import { aplicarCorreccion, normalizarAcorde } from '@/lib/motores/corregir-acorde'
import { esTamanoValido } from '@/lib/motores/tamano-letra'
import { QUIENES, huellaDeEstrofa, marcarEstrofa } from '@/lib/motores/quien-canta'

/**
 * Guarda la transposición del usuario para un canto (H3).
 *
 * Una server action es alcanzable por POST directo, no solo desde la UI, así
 * que valida la entrada con Zod y comprueba el rol en el servidor ADEMÁS de la
 * RLS. Sin esa comprobación previa, la RLS rechazaría en silencio con cero
 * filas afectadas y el usuario creería que guardó (PRD §8.3).
 *
 * El tamaño de letra ya no viaja acá: desde el 2026-10-17 es de la persona y se
 * guarda con `guardarTamanoLetra`. La columna vieja toma su default al insertar
 * y no se toca al actualizar.
 */

const Entrada = z.object({
  cantoId: z.string().uuid(),
  coroId: z.string().uuid(),
  transposicion: z.number().int().min(-11).max(11),
})

export type ResultadoPreferencia = { ok: true } | { ok: false; error: string }

export async function guardarTransposicion(raw: unknown): Promise<ResultadoPreferencia> {
  const datos = Entrada.parse(raw)

  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Tu sesión expiró. Vuelve a entrar.' }

  if (!puede(sesion.sujeto, 'guardar_preferencia_propia')) {
    return { ok: false, error: 'Tu cuenta todavía no está habilitada.' }
  }

  const supabase = await createClient()

  // `perfil_id` sale de la sesión, NUNCA del cliente: si viniera en la entrada,
  // cualquiera podría escribir la preferencia de otro. La RLS igual lo frena,
  // pero no se le deja ni intentarlo.
  const { error } = await supabase.from('preferencias_lectura').upsert(
    {
      perfil_id: sesion.usuarioId,
      canto_id: datos.cantoId,
      coro_id: datos.coroId,
      transposicion: normalizarSemitonos(datos.transposicion),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'perfil_id,canto_id' }
  )

  if (error) return { ok: false, error: 'No se guardó el cambio de tono. Revisa tu conexión.' }

  revalidatePath(`/repertorio/${datos.cantoId}`)
  return { ok: true }
}

/**
 * Guarda el tamaño de letra de esta PERSONA (2026-10-17, antes era por canto).
 *
 * Vale en todo el repertorio y en toda la misa: quien ve poco lo elige una vez.
 * Misma tabla y misma política que «ver acordes» (H11): cada uno escribe solo
 * la suya, y no cuelga de ningún coro.
 */
export async function guardarTamanoLetra(valor: unknown): Promise<ResultadoPreferencia> {
  if (!esTamanoValido(valor)) {
    return { ok: false, error: 'Ese tamaño de letra no está disponible.' }
  }

  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Tu sesión expiró. Vuelve a entrar.' }

  if (!puede(sesion.sujeto, 'guardar_preferencia_propia')) {
    return { ok: false, error: 'Tu cuenta todavía no está habilitada.' }
  }

  const supabase = await createClient()

  const { error } = await supabase.from('preferencias_perfil').upsert(
    {
      perfil_id: sesion.usuarioId,
      tamano_letra: valor,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'perfil_id' }
  )

  if (error) return { ok: false, error: 'No se guardó el tamaño de letra. Revisa tu conexión.' }

  // Todo canto que se abra después, en el repertorio o en la misa.
  revalidatePath('/', 'layout')
  return { ok: true }
}

/**
 * Guarda si esta PERSONA quiere ver los acordes (H11).
 *
 * No lleva `cantoId` en la entrada porque la preferencia no es de un canto: es
 * de quien lee, y vale en todo el repertorio. Por eso tampoco lleva `coroId`:
 * la fila no cuelga de ningún coro y no hay alcance que comprobar.
 *
 * Se revalida el layout entero —no una ruta— porque el cambio afecta cualquier
 * canto que se abra después, no solo el que estaba en pantalla.
 */
export async function guardarMostrarAcordes(valor: unknown): Promise<ResultadoPreferencia> {
  const mostrar = z.boolean().parse(valor)

  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Tu sesión expiró. Vuelve a entrar.' }

  if (!puede(sesion.sujeto, 'guardar_preferencia_propia')) {
    return { ok: false, error: 'Tu cuenta todavía no está habilitada.' }
  }

  const supabase = await createClient()

  // `perfil_id` sale de la sesión, nunca del cliente (igual que en H3).
  const { error } = await supabase.from('preferencias_perfil').upsert(
    {
      perfil_id: sesion.usuarioId,
      mostrar_acordes: mostrar,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'perfil_id' }
  )

  if (error) return { ok: false, error: 'No pudimos guardar tu preferencia.' }

  revalidatePath('/repertorio', 'layout')
  return { ok: true }
}

/**
 * Corrige UN acorde en el lugar, desde la hoja de diagramas (H19-B).
 *
 * Es la misma capacidad que «Editar» (`editar_canto`, solo el director) y el
 * mismo `update` de `cantos.cifrado` que cubre `cantos_write`: cero cambios de
 * RLS. El rastro no se escribe acá — lo deja el trigger de H19-A, que no se
 * olvida, y por eso una corrección es UNA versión en el historial.
 *
 * Tres comprobaciones antes de escribir, en este orden:
 *
 *   1. **Que el canto sea el que se veía.** El cliente manda el cifrado tal
 *      como lo tenía en pantalla; si la base, transpuesta igual, ya no da ese
 *      texto, alguien editó el canto entretanto. Comparar solo el acorde tocado
 *      no alcanza: si se borró uno más arriba, el ordinal apunta a otro, y si
 *      ese se llama igual la corrección caería en un acorde que nadie tocó.
 *   2. **El nombre se baja al tono guardado.** El director escribe lo que ve
 *      (`G#7` con +2); la base guarda `F#7`. La transposición es de la persona,
 *      no del canto (decisión 10).
 *   3. **El `update` lleva el `updated_at` que se leyó**: si cambió entre la
 *      lectura y la escritura, afecta cero filas en vez de pisar.
 */

const NumeroAcorde = z.number().int().min(0).max(5000)
const NombreAcorde = z.string().max(20)

const EntradaCorreccion = z.object({
  cantoId: z.string().uuid(),
  transposicion: z.number().int().min(-11).max(11),
  /** El cifrado como lo veía el director: ya transpuesto. */
  vista: z.string().max(50000),
  correccion: z.discriminatedUnion('tipo', [
    z.object({
      tipo: z.literal('cambiar'),
      indice: NumeroAcorde,
      acorde: NombreAcorde,
      pasos: z.number().int().min(-200).max(200),
    }),
    z.object({ tipo: z.literal('borrar'), indice: NumeroAcorde }),
    z.object({
      tipo: z.literal('agregar'),
      despuesDe: NumeroAcorde,
      acorde: NombreAcorde,
      pasos: z.number().int().min(-200).max(200),
    }),
  ]),
})

export type ResultadoCorreccionAcorde =
  { ok: true; indice: number | null } | { ok: false; error: string }

const NO_PUEDE_CORREGIR = 'No tienes permiso para cambiar el repertorio de este coro.'
const CAMBIO_ENTRETANTO = 'El canto cambió mientras lo corregías. Recárgalo y vuelve a intentar.'

export async function corregirAcorde(raw: unknown): Promise<ResultadoCorreccionAcorde> {
  const entrada = EntradaCorreccion.safeParse(raw)
  if (!entrada.success) return { ok: false, error: 'Esa corrección no se entiende.' }
  const { cantoId, vista, correccion } = entrada.data
  const n = normalizarSemitonos(entrada.data.transposicion)

  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Sesión expirada. Vuelve a entrar.' }
  if (!sesion.coroActivo) return { ok: false, error: 'No perteneces a ningún coro.' }
  if (!puede(sesion.sujeto, 'editar_canto')) return { ok: false, error: NO_PUEDE_CORREGIR }

  const supabase = await createClient()

  const { data: canto, error: errorLectura } = await supabase
    .from('cantos')
    .select('cifrado, updated_at')
    .eq('id', cantoId)
    .maybeSingle()

  if (errorLectura) return { ok: false, error: 'No pudimos leer el canto.' }
  if (!canto) return { ok: false, error: 'Ese canto no está acá.' }

  // 1 · ¿Es el canto que se veía?
  if (transponer(canto.cifrado, n) !== vista) return { ok: false, error: CAMBIO_ENTRETANTO }

  // 2 · El nombre, al tono guardado. Se valida ANTES de transponer: un nombre
  // que no es acorde volvería intacto de `transponerAcorde` y pasaría.
  let enTonoGuardado = correccion
  if (correccion.tipo !== 'borrar') {
    const nombre = normalizarAcorde(correccion.acorde)
    if (nombre === null)
      return {
        ok: false,
        error: `«${correccion.acorde.trim()}» no es un acorde.`,
      }
    enTonoGuardado = { ...correccion, acorde: transponerAcorde(nombre, -n) }
  }

  const r = aplicarCorreccion(canto.cifrado, enTonoGuardado)
  if (!r.ok) return r

  // 3 · Escribe solo si nadie escribió desde la lectura.
  const { data, error } = await supabase
    .from('cantos')
    .update({ cifrado: r.cifrado, updated_at: new Date().toISOString() })
    .eq('id', cantoId)
    .eq('updated_at', canto.updated_at)
    .select('id')
    .maybeSingle()

  if (error) return { ok: false, error: 'No pudimos guardar la corrección.' }
  if (!data) {
    // Cero filas: o cambió entretanto, o la RLS dijo que no (§14). Se distingue
    // releyendo, para no culpar al permiso de lo que fue un choque.
    const { data: ahora } = await supabase
      .from('cantos')
      .select('updated_at')
      .eq('id', cantoId)
      .maybeSingle()
    return {
      ok: false,
      error: ahora && ahora.updated_at !== canto.updated_at ? CAMBIO_ENTRETANTO : NO_PUEDE_CORREGIR,
    }
  }

  revalidatePath(`/repertorio/${cantoId}`)
  revalidatePath(`/repertorio/${cantoId}/versiones`)
  return { ok: true, indice: r.indice }
}

/**
 * El director marca quién canta una estrofa (herramienta «Quién canta cada
 * estrofa», 2026-10-17). La marca vive DENTRO del cifrado (`{x_canta: …}`,
 * ver `quien-canta.ts`), así que es el mismo `update` de `cantos.cifrado` que
 * una corrección de acorde: misma capacidad, misma RLS, y el trigger de H19-A
 * deja la versión en el historial.
 *
 * La pantalla manda la letra de la primera línea de la estrofa (`huella`): si
 * en la base esa estrofa ya no empieza así, alguien editó el canto entretanto.
 */
const EntradaMarca = z.object({
  cantoId: z.string().uuid(),
  estrofa: z.number().int().min(0).max(500),
  huella: z.string().max(500),
  canta: z.enum(QUIENES).nullable(),
})

export async function marcarQuienCanta(raw: unknown): Promise<ResultadoPreferencia> {
  const entrada = EntradaMarca.safeParse(raw)
  if (!entrada.success) return { ok: false, error: 'Esa marca no se entiende.' }
  const { cantoId, estrofa, huella, canta } = entrada.data

  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Sesión expirada. Vuelve a entrar.' }
  if (!sesion.coroActivo) return { ok: false, error: 'No perteneces a ningún coro.' }
  if (!puede(sesion.sujeto, 'editar_canto')) return { ok: false, error: NO_PUEDE_CORREGIR }

  const supabase = await createClient()
  const { data: canto, error: errorLectura } = await supabase
    .from('cantos')
    .select('cifrado, updated_at')
    .eq('id', cantoId)
    .maybeSingle()
  if (errorLectura) return { ok: false, error: 'No pudimos leer el canto.' }
  if (!canto) return { ok: false, error: 'Ese canto no está acá.' }

  if (huellaDeEstrofa(canto.cifrado, estrofa) !== huella) return { ok: false, error: CAMBIO_ENTRETANTO }

  const cifrado = marcarEstrofa(canto.cifrado, estrofa, canta)
  if (cifrado === canto.cifrado) return { ok: true }

  const { data, error } = await supabase
    .from('cantos')
    .update({ cifrado, updated_at: new Date().toISOString() })
    .eq('id', cantoId)
    .eq('updated_at', canto.updated_at)
    .select('id')
    .maybeSingle()
  if (error) return { ok: false, error: 'No pudimos guardar la marca.' }
  // Cero filas: cambió entretanto o la RLS dijo que no (§14).
  if (!data) return { ok: false, error: CAMBIO_ENTRETANTO }

  // La marca se ve en la ficha y en cualquier misa que tenga el canto.
  revalidatePath(`/repertorio/${cantoId}`)
  revalidatePath(`/repertorio/${cantoId}/versiones`)
  revalidatePath('/misas', 'layout')
  return { ok: true }
}
