'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { PARTES } from '@/lib/motores/lecturas'
import {
  traerLecturasDeIglesia,
  type MotivoDeTraida,
} from '@/lib/datos/lecturas-iglesia'
import type { ParteParaGuardar } from '@/lib/datos/lecturas'

/**
 * Lecturas de la misa — H30, docs/PRD.md §9.
 *
 * `importarLecturas` NO escribe: devuelve lo que trajo la página pública para
 * que el director lo revise y confirme. `guardarLecturas` es la única escritura
 * y pasa por la RPC atómica `guardar_lecturas`. La comprobación previa existe
 * para devolver un mensaje claro; la RLS de `misa_lectura` es la seguridad.
 */

export type ResultadoLecturas =
  | { ok: true; partes: ParteParaGuardar[]; url: string }
  | { ok: false; motivo?: MotivoDeTraida; error: string }

const NO_HABILITADO = 'No tienes permiso para editar las lecturas de esta misa.'

/** Sesión + capacidad. Devuelve el mensaje a mostrar, o `null` si puede pasar. */
async function problemaDePermiso(): Promise<string | null> {
  const sesion = await obtenerSesion()
  if (!sesion) return 'Tu sesión expiró. Vuelve a entrar.'
  if (!puede(sesion.sujeto, 'asignar_cantos_misa')) return NO_HABILITADO
  return null
}

/** Un motivo, un mensaje accionable: qué pasó y qué puede hacer el director. */
const MENSAJE_DE_MOTIVO: Record<MotivoDeTraida, string> = {
  sin_datos:
    'La página de Iglesia.cl no trae lecturas publicadas para esa fecha. Puedes pegar el texto a mano.',
  complejo:
    'Ese día trae una forma que no podemos importar (varios formularios, una secuencia o más de dos lecturas). Pega el texto a mano.',
  // No se afirma que el sitio devolvió otro día: también puede ser que su
  // página no traiga una fecha que podamos reconocer.
  fecha:
    'No pudimos confirmar que la página sea del día pedido. Revisa la fecha o pega el texto a mano.',
  red: 'No pudimos conectar con Iglesia.cl. Intenta de nuevo en un momento o pega el texto a mano.',
}

// -----------------------------------------------------------------------------
// Traer de Iglesia.cl (solo lectura)
// -----------------------------------------------------------------------------

const Importar = z.object({
  misaId: z.string().uuid(),
  // El campo de fecha de la UI manda `''` cuando está vacío, y `null` si la
  // misa no tiene fecha y el editor no tocó el campo.
  fecha: z
    .string()
    .trim()
    .refine(
      (valor) => valor === '' || z.iso.date().safeParse(valor).success,
      'Esa fecha no es válida.'
    )
    .nullish(),
})

/**
 * Trae las partes del día desde Iglesia.cl y las devuelve SIN guardar.
 *
 * La fecha es la que eligió el director o, si no eligió, la de la misa. Una
 * misa sin fecha no tiene día que pedir: se avisa sin llamar al sitio. La misa
 * se lee con la RLS puesta, así que una que no se puede ver tampoco se importa.
 */
export async function importarLecturas(raw: unknown): Promise<ResultadoLecturas> {
  const datos = Importar.safeParse(raw)
  if (!datos.success) {
    return { ok: false, error: datos.error.issues[0]?.message ?? 'Revisa los datos.' }
  }

  const problema = await problemaDePermiso()
  if (problema) return { ok: false, error: problema }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('misas')
    .select('fecha, coro_id')
    .eq('id', datos.data.misaId)
    .maybeSingle()

  if (error) return { ok: false, error: 'No pudimos leer la misa.' }
  if (!data) return { ok: false, error: 'No tienes acceso a esta misa.' }

  const misa = data as { fecha: string | null; coro_id: string }
  const fecha = datos.data.fecha || misa.fecha
  if (!fecha) {
    return {
      ok: false,
      error: 'Esta misa no tiene fecha. Elige el día que quieres traer en el campo de fecha.',
    }
  }

  const traida = await traerLecturasDeIglesia(fecha)
  if (!traida.ok) {
    return { ok: false, motivo: traida.motivo, error: MENSAJE_DE_MOTIVO[traida.motivo] }
  }

  // Una sola marca de tiempo para todas las partes de esta importación.
  const traidoEn = new Date().toISOString()

  return {
    ok: true,
    partes: traida.partes.map(
      (parte): ParteParaGuardar => ({
        ...parte,
        fuente: 'iglesia.cl',
        fuenteUrl: traida.url,
        traidoEn,
      })
    ),
    url: traida.url,
  }
}

// -----------------------------------------------------------------------------
// Guardar (la única escritura)
// -----------------------------------------------------------------------------

const Parte = z.object({
  tipo: z.enum(PARTES),
  referencia: z.string().trim().max(200, 'La referencia no puede pasar de 200 caracteres.'),
  texto: z.string().max(20000, 'El texto no puede pasar de 20.000 caracteres.'),
  fuente: z.enum(['iglesia.cl', 'manual']),
  fuenteUrl: z
    .string()
    .trim()
    .max(2000, 'La dirección de la fuente es demasiado larga.')
    .nullish()
    .transform((valor) => (valor ? valor : null)),
  traidoEn: z
    .string()
    .refine(
      (valor) => valor === '' || z.iso.datetime({ offset: true }).safeParse(valor).success,
      'La fecha de la importación no es válida.'
    )
    .nullish()
    .transform((valor) => (valor ? valor : null)),
})

const Guardar = z.object({
  misaId: z.string().uuid(),
  partes: z
    .array(Parte)
    .max(PARTES.length, 'Una misa tiene como máximo cuatro lecturas.')
    .superRefine((partes, ctx) => {
      const vistas = new Set<string>()
      for (const parte of partes) {
        if (vistas.has(parte.tipo)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Cada parte puede aparecer una sola vez.',
          })
          return
        }
        vistas.add(parte.tipo)
      }
    }),
})

/**
 * Reemplaza en bloque las partes de la misa con la RPC `guardar_lecturas`.
 *
 * Una parte con el texto vacío se borra (así se quita la segunda lectura de un
 * día que no la tiene). Todo pasa en una transacción en la base: si una parte
 * falla, no queda media misa guardada.
 */
export async function guardarLecturas(
  raw: unknown
): Promise<{ ok: true } | { ok: false; error: string }> {
  const datos = Guardar.safeParse(raw)
  if (!datos.success) {
    return { ok: false, error: datos.error.issues[0]?.message ?? 'Revisa los datos.' }
  }

  const problema = await problemaDePermiso()
  if (problema) return { ok: false, error: problema }

  const supabase = await createClient()
  const { error } = await supabase.rpc('guardar_lecturas', {
    p_misa_id: datos.data.misaId,
    // Claves snake_case: son las columnas que espera `jsonb_to_recordset`.
    p_partes: datos.data.partes.map((parte) => ({
      tipo: parte.tipo,
      referencia: parte.referencia,
      texto: parte.texto,
      fuente: parte.fuente,
      fuente_url: parte.fuenteUrl,
      traido_en: parte.traidoEn,
    })),
  })

  if (error) {
    // La RPC levanta «No tienes permiso» o «La misa no existe»: ese mensaje es
    // el que el director necesita, no un «no pudimos» genérico.
    return { ok: false, error: error.message || 'No pudimos guardar las lecturas.' }
  }

  // El `layout` alcanza también la ejecución (`[filaId]`), que lee las mismas
  // partes. Mismo criterio que `cambiarTono` en las acciones de misas.
  revalidatePath(`/misas/${datos.data.misaId}`, 'layout')
  return { ok: true }
}
