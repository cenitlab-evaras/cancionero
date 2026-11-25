import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { perfilesConVinculo } from '@/lib/datos/gobierno'
import { invitacionesPendientes } from '@/lib/datos/invitaciones'
import { resumenDeMiembros } from '@/lib/motores/gobierno'
import Cabecera from '@/app/componentes/cabecera'
import ListaMiembros from './lista'
import { fichasDelCoro } from '@/lib/datos/ficha'

export const metadata = { title: 'Miembros del coro · Cantoral' }

export default async function MiembrosPage() {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  if (!sesion.coroActivo) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-10">
          <h1 className="titulo-pantalla leading-tight">Miembros</h1>
          <p className="mt-2 text-sm text-texto-tenue">
            Todavía no perteneces a ningún coro.
          </p>
        </main>
      </>
    )
  }

  // La pantalla consulta la matriz para no ofrecer lo que la RLS va a rechazar
  // igual. La seguridad la deciden la RLS y la action, no esto (§8.3).
  if (!puede(sesion.sujeto, 'administrar_miembros')) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-10">
          <h1 className="titulo-pantalla leading-tight text-peligro">
            No tienes permiso para administrar los miembros
          </h1>
          <p className="mt-2 max-w-prose text-sm text-texto-tenue">
            Invitar gente al coro y quitarla es trabajo del director.
          </p>
          <Link
            href="/repertorio"
            className="mt-6 inline-block text-sm text-acento underline underline-offset-2"
          >
            Volver a las canciones
          </Link>
        </main>
      </>
    )
  }

  // H14: la RLS ya filtra —solo el director del coro las lee—, pero la
  // pantalla no ofrece lo que la matriz no concede (§8.3).
  // 2026-11-25: las invitaciones de miembro del coro son del director; la RLS
  // deja ver solo las de su coro que además son de miembro.
  const [perfiles, fichas, invitaciones] = await Promise.all([
    perfilesConVinculo(sesion.coroActivo.id),
    puede(sesion.sujeto, 'ver_ficha_del_coro')
      ? fichasDelCoro(sesion.coroActivo.id)
      : Promise.resolve([]),
    invitacionesPendientes(sesion.coroActivo.id),
  ])
  const resumen = resumenDeMiembros(perfiles)

  return (
    <>
      <Cabecera sesion={sesion} />

      {/* Destino de primer nivel (se llega desde «Más»): sin flecha de volver. */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-10">
        <h1 className="titulo-pantalla leading-tight">Miembros</h1>
        <p className="mt-1 text-sm text-texto-tenue">{sesion.coroActivo.nombre}</p>

        <ListaMiembros
          enElCoro={resumen.enElCoro}
          yoId={sesion.usuarioId}
          fichas={fichas}
          invitaciones={invitaciones}
        />
      </main>
    </>
  )
}
