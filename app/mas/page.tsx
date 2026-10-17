import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import Cabecera from '@/app/componentes/cabecera'
import BotonSalir from '@/app/componentes/boton-salir'
import Opciones, { type Fila } from './opciones'
import {
  IconoAdmin,
  IconoArchivo,
  IconoCambiar,
  IconoHistorial,
  IconoMezcla,
  IconoMiembros,
  IconoPerfil,
  IconoSugerencias,
  IconoRepertorio,
} from '@/app/componentes/iconos'

export const metadata = { title: 'Más · Cantoral' }

/**
 * Lo que no entra en los cuatro destinos de la barra (rediseño 2026-10-17).
 *
 * Antes Historial y Sugerencias vivían al pie de un repertorio de 4 700 px, y
 * Salir estaba a un toque en la cabecera, también en plena misa. Acá cada cosa
 * tiene su fila de 44 px, agrupada por para qué sirve, y solo aparece lo que la
 * matriz deja usar a esta persona.
 *
 * Sin «Buscar un canto» de la cabecera (el dueño, 2026-10-17): acá no se busca
 * una canción sino una opción, y la lupa del título filtra estas filas.
 */
export default async function MasPage() {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  const s = sesion.sujeto
  const hayCoro = !!sesion.coroActivo

  const planificar: Fila[] = []
  if (hayCoro) {
    planificar.push({
      href: '/historial',
      texto: 'Historial',
      detalle: 'Qué se canta seguido y qué se está dejando',
      icono: <IconoHistorial />,
    })
    if (puede(s, 'ver_sugerencias')) {
      planificar.push({
        href: '/sugerencias',
        texto: 'Sugerencias',
        detalle: 'Lo que el coro pide para cada momento',
        icono: <IconoSugerencias />,
      })
    }
  }

  // Herramientas (2026-10-17): interruptores de cada uno, sobre todo para ensayar.
  planificar.push({
    href: '/herramientas',
    texto: 'Herramientas',
    detalle: 'Quién canta cada estrofa, tu cuerda, dar el tono, Do-Re-Mi',
    claves: puede(s, 'editar_canto') ? ['cargar un canto nuevo', 'agregar canción'] : [],
    icono: <IconoMezcla />,
  })

  const coro: Fila[] = []
  if (hayCoro) {
    coro.push({
      href: '/canciones',
      texto: 'Canciones',
      detalle: 'Todas, una vez cada una: cuántas hay y cuáles se repiten',
      icono: <IconoRepertorio />,
    })
  }
  if (hayCoro && puede(s, 'ver_ficha_del_coro')) {
    coro.push({ href: '/coro/miembros', texto: 'Miembros', icono: <IconoMiembros /> })
  }
  if (hayCoro && puede(s, 'archivar_canto')) {
    coro.push({ href: '/repertorio/archivados', texto: 'Cantos archivados', icono: <IconoArchivo /> })
  }
  if (puede(s, 'aprobar_perfil')) {
    coro.push({ href: '/admin/perfiles', texto: 'Administración', icono: <IconoAdmin /> })
  }

  const cuenta: Fila[] = []
  if (hayCoro && puede(s, 'editar_ficha_propia')) {
    cuenta.push({
      href: '/mi-perfil',
      texto: 'Mi perfil',
      detalle: 'Tu cuerda, cuándo puedes y el tamaño de letra',
      icono: <IconoPerfil />,
    })
  }
  if (sesion.coros.length > 1) {
    cuenta.push({
      href: '/coros',
      texto: 'Cambiar de coro',
      detalle: `Ahora: ${sesion.coroActivo?.nombre ?? 'ninguno'}`,
      icono: <IconoCambiar />,
    })
  }

  return (
    <>
      <Cabecera sesion={sesion} buscador={false} />

      <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-10">
        <Opciones
          grupos={[
            { titulo: 'Planificar', filas: planificar },
            { titulo: 'El coro', filas: coro },
            { titulo: 'Tu cuenta', filas: cuenta },
          ]}
          grupoDeSalir="Tu cuenta"
          salir={<BotonSalir />}
          arriba={<p className="mt-1 text-sm text-texto-tenue">{sesion.email}</p>}
        />
      </main>
    </>
  )
}
