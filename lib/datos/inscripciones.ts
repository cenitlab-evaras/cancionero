import { createClient } from '@/lib/supabase/server'
import { esAporteValido, type Inscrito } from '@/lib/motores/inscripcion'

/**
 * Quién va a una misa (H15).
 *
 * Como en el resto de la capa de datos, no se re-chequean permisos: la RLS
 * decide qué filas salen. `misa_participante_select` es `puede_ver_coro`, así
 * que quien no es del coro obtiene cero filas — y la RUTA es la que distingue
 * "nadie se anotó" de "no tienes acceso" (§14).
 *
 * LO QUE VE CADA UNO, Y POR QUÉ NO ES UNA INCONSISTENCIA:
 *   · La LISTA de inscritos la ve todo el coro. Los nombres salen de
 *     `perfiles`, cuya política ya deja leer a cualquier interno aprobado.
 *   · La TESITURA de cada quien NO: vive en `ficha_miembro`, que desde H14 solo
 *     leen su dueño y el director. Por eso el resumen por voz es del director y
 *     el resto ve «4 anotados · 3 cantan · 1 guitarra». Es la decisión de H14
 *     sostenida, no un olvido de este hito.
 *   · QUIÉN FALTA tampoco: pide listar `coro_acceso`, que también es del
 *     director (`coro_acceso_select`).
 */
export async function inscritosDeMisa(misaId: string): Promise<Inscrito[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('misa_participante')
    .select('perfil_id, aporte, instrumento, perfiles(nombre, email)')
    .eq('misa_id', misaId)
    .order('created_at', { ascending: true })

  if (error) throw error

  return (data ?? []).flatMap((fila) => {
    // Un aporte que no reconocemos no se dibuja a medias: se omite. La base ya
    // lo impide con su `check`; esto es el cinturón del lado de la lectura.
    if (!esAporteValido(fila.aporte)) return []
    const perfil = fila.perfiles as unknown as { nombre: string | null; email: string } | null
    return [
      {
        perfilId: fila.perfil_id,
        nombre: perfil?.nombre ?? perfil?.email ?? null,
        aporte: fila.aporte,
        instrumento: fila.instrumento,
      },
    ]
  })
}
