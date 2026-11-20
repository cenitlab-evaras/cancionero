import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import Cabecera from '@/app/componentes/cabecera'
import BotonSalir from '@/app/componentes/boton-salir'
import Opciones, { type Fila } from './opciones'
import {
  IconoArchivo,
  IconoCambiar,
  IconoHistorial,
  IconoMezcla,
  IconoMiembros,
  IconoPerfil,
  IconoSugerencias,
  IconoUsuarios,
} from '@/app/componentes/iconos'

export const metadata = { title: 'Más · Cantoral' }

/**
 * Lo que no entra en los cuatro destinos de la barra (rediseño 2026-10-17).
 * Desde el 2026-11-20 es una sola lista: el dueño lo pidió «mucho más simple»
 * y se fueron los grupos, las descripciones y la lupa. Solo aparece lo que la
 * matriz deja usar a esta persona.
 */
export default async function MasPage() {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  const s = sesion.sujeto
  const hayCoro = !!sesion.coroActivo

  const filas: Fila[] = []

  if (hayCoro && puede(s, 'ver_ficha_del_coro')) {
    filas.push({ href: '/coro/miembros', texto: 'Miembros', icono: <IconoMiembros /> })
  }
  if (hayCoro) {
    filas.push({ href: '/historial', texto: 'Historial', icono: <IconoHistorial /> })
    if (puede(s, 'ver_sugerencias')) {
      filas.push({ href: '/sugerencias', texto: 'Sugerencias', icono: <IconoSugerencias /> })
    }
  }
  filas.push({ href: '/herramientas', texto: 'Herramientas', icono: <IconoMezcla /> })
  if (hayCoro && puede(s, 'archivar_canto')) {
    filas.push({ href: '/repertorio/archivados', texto: 'Cantos archivados', icono: <IconoArchivo /> })
  }
  if (puede(s, 'aprobar_perfil')) {
    filas.push({ href: '/admin/perfiles', texto: 'Usuarios', icono: <IconoUsuarios /> })
  }
  if (hayCoro && puede(s, 'editar_ficha_propia')) {
    filas.push({ href: '/mi-perfil', texto: 'Mi perfil', icono: <IconoPerfil /> })
  }
  if (sesion.coros.length > 1) {
    filas.push({ href: '/coros', texto: 'Cambiar de coro', icono: <IconoCambiar /> })
  }

  return (
    <>
      <Cabecera sesion={sesion} buscador={false} />

      <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-10">
        <Opciones
          filas={filas}
          salir={<BotonSalir />}
          arriba={<p className="mt-1 text-sm text-texto-tenue">{sesion.email}</p>}
        />
      </main>
    </>
  )
}
