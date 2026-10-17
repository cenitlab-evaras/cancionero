import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import Cabecera from '@/app/componentes/cabecera'
import BotonSalir from '@/app/componentes/boton-salir'
import TituloSeccion from '@/app/componentes/titulo-seccion'
import {
  IconoAdmin,
  IconoArchivo,
  IconoCambiar,
  IconoHistorial,
  IconoMezcla,
  IconoMiembros,
  IconoPerfil,
  IconoSeguir,
  IconoSugerencias,
  IconoRepertorio,
} from '@/app/componentes/iconos'

export const metadata = { title: 'Más · Cantoral' }

type Fila = { href: string; texto: string; detalle?: string; icono: ReactNode }

/**
 * Lo que no entra en los cuatro destinos de la barra (rediseño 2026-10-17).
 *
 * Antes Historial y Sugerencias vivían al pie de un repertorio de 4 700 px, y
 * Salir estaba a un toque en la cabecera, también en plena misa. Acá cada cosa
 * tiene su fila de 44 px, agrupada por para qué sirve, y solo aparece lo que la
 * matriz deja usar a esta persona.
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
      <Cabecera sesion={sesion} />

      <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-10">
        <h1 className="titulo-libro text-[1.75rem] leading-tight">Más</h1>
        <p className="mt-1 text-sm text-texto-tenue">{sesion.email}</p>

        <Grupo titulo="Planificar" filas={planificar} />
        <Grupo titulo="El coro" filas={coro} />

        <section className="mt-8">
          <TituloSeccion>Tu cuenta</TituloSeccion>
          <ul className="mt-2">
            {cuenta.map((f) => (
              <FilaMas key={f.href} fila={f} />
            ))}
            <li>
              <BotonSalir />
            </li>
          </ul>
        </section>
      </main>
    </>
  )
}

function Grupo({ titulo, filas }: { titulo: string; filas: Fila[] }) {
  if (filas.length === 0) return null
  return (
    <section className="mt-8">
      <TituloSeccion>{titulo}</TituloSeccion>
      <ul className="mt-2">
        {filas.map((f) => (
          <FilaMas key={f.href} fila={f} />
        ))}
      </ul>
    </section>
  )
}

function FilaMas({ fila }: { fila: Fila }) {
  return (
    <li>
      <Link
        href={fila.href}
        className="tactil flex items-center gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-superficie"
      >
        <span className="text-texto-tenue">{fila.icono}</span>
        <span className="min-w-0 flex-1">
          <span className="block">{fila.texto}</span>
          {fila.detalle && (
            <span className="block truncate text-sm text-texto-tenue">{fila.detalle}</span>
          )}
        </span>
        <IconoSeguir tamano={18} className="shrink-0 text-texto-tenue" />
      </Link>
    </li>
  )
}
