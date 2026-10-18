import type { SesionCantoral } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import type { Herramienta } from '@/lib/motores/herramientas'
import { esTesituraValida } from '@/lib/motores/ficha'
import { CUERDAS_DEL_CORO, cuerdaPorTesitura, type CuerdaDelCoro } from '@/lib/motores/cuerdas'
import type { HerramientasDelCifrado } from '@/app/componentes/cifrado'
import { miFicha } from './ficha'

/**
 * Lo que las «Herramientas» que prendió esta persona cambian en un canto
 * (2026-10-17). Lo usan la ficha del canto y el canto dentro de la misa, para
 * que las dos pantallas digan lo mismo.
 *
 * La ficha solo se consulta si «Resaltar mi cuerda» está prendida: es la única
 * que necesita la tesitura.
 */
export async function herramientasDelCanto(
  sesion: SesionCantoral,
  herramientas: Herramienta[],
  cantoId: string
): Promise<HerramientasDelCifrado & { darTono: boolean }> {
  const resaltarMiCuerda = herramientas.includes('mi_cuerda')
  const quienCanta = herramientas.includes('quien_canta')

  let miCuerda: CuerdaDelCoro | null = null
  if (resaltarMiCuerda && sesion.coroActivo) {
    const guardada = (await miFicha(sesion.coroActivo.id))?.tesitura
    const tesitura = esTesituraValida(guardada) ? guardada : null
    miCuerda = cuerdaPorTesitura(tesitura, [...CUERDAS_DEL_CORO]) as CuerdaDelCoro | null
  }

  return {
    latina: herramientas.includes('notacion_latina'),
    quienCanta,
    resaltarMiCuerda,
    miCuerda,
    marcar: quienCanta && puede(sesion.sujeto, 'editar_canto') ? { cantoId } : null,
    darTono: herramientas.includes('dar_tono'),
  }
}
