import { createClient } from '@/lib/supabase/server'
import { hoyISO } from '@/lib/datos/historial'
import { edadEn, esMenorDeEdad, ordenarPorTesitura } from '@/lib/motores/ficha'

/**
 * Consultas del perfil del miembro (H14).
 *
 * OJO CON EL NOMBRE: en pantalla y en la URL esto se llama «perfil» desde el
 * 2026-09-02, pero la tabla, las políticas y estos tipos siguen diciendo
 * «ficha». Es deliberado: renombrar `ficha_miembro` obliga a una migración
 * sobre datos que ya están en producción y a rehacer las seis comprobaciones
 * de RLS, sin cambiarle nada a quien usa la app. Si algún día se hace, se hace
 * entero — no a medias, que es la única forma peor que esta.
 *
 * Como en el resto de la capa de datos, no se re-chequean permisos: la RLS
 * decide qué filas salen. Un músico pidiendo las fichas del coro obtiene solo
 * la suya, y eso es correcto — `ficha_miembro_select` es
 * `perfil_id = auth.uid() or es_director_de(coro_id)`.
 *
 * La EDAD no se consulta: no existe como columna. Se calcula acá con el día del
 * coro, que es lo que `fecha.ts` fijó al desplegar.
 */

export type FichaPropia = {
  fechaNacimiento: string | null
  tesitura: string | null
  disponibilidad: string | null
}

export type FichaDeMiembro = FichaPropia & {
  perfilId: string
  nombre: string | null
  email: string
  rolLocal: string
  /** Calculada al leer, nunca guardada. `null` si no declaró su nacimiento. */
  edad: number | null
  esMenor: boolean | null
}

/** La ficha de quien pregunta, en el coro activo. `null` si todavía no cargó nada. */
export async function miFicha(coroId: string): Promise<FichaPropia | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('ficha_miembro')
    .select('fecha_nacimiento, tesitura, disponibilidad')
    .eq('perfil_id', user.id)
    .eq('coro_id', coroId)
    .maybeSingle()

  if (!data) return null
  return {
    fechaNacimiento: data.fecha_nacimiento,
    tesitura: data.tesitura,
    disponibilidad: data.disponibilidad,
  }
}

/**
 * Las fichas del coro, de voz aguda a grave.
 *
 * Devuelve a TODOS los miembros, tengan ficha o no: un coro donde la mitad no
 * cargó nada tiene que verse igual, o el director no sabe a quién le falta.
 */
export async function fichasDelCoro(coroId: string): Promise<FichaDeMiembro[]> {
  const supabase = await createClient()

  const { data: miembros } = await supabase
    .from('coro_acceso')
    .select('perfil_id, rol_local, perfiles(nombre, email)')
    .eq('coro_id', coroId)

  if (!miembros?.length) return []

  const { data: fichas } = await supabase
    .from('ficha_miembro')
    .select('perfil_id, fecha_nacimiento, tesitura, disponibilidad')
    .eq('coro_id', coroId)

  const porPerfil = new Map((fichas ?? []).map((f) => [f.perfil_id, f]))
  const hoy = hoyISO()

  const filas: FichaDeMiembro[] = miembros.map((m) => {
    const perfil = m.perfiles as unknown as { nombre: string | null; email: string } | null
    const ficha = porPerfil.get(m.perfil_id)
    const nacimiento = ficha?.fecha_nacimiento ?? null

    return {
      perfilId: m.perfil_id,
      nombre: perfil?.nombre ?? null,
      email: perfil?.email ?? '',
      rolLocal: m.rol_local,
      fechaNacimiento: nacimiento,
      tesitura: ficha?.tesitura ?? null,
      disponibilidad: ficha?.disponibilidad ?? null,
      edad: edadEn(nacimiento, hoy),
      esMenor: esMenorDeEdad(nacimiento, hoy),
    }
  })

  return ordenarPorTesitura(filas)
}
