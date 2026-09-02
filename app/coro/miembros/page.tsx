import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { perfilesConVinculo } from '@/lib/datos/gobierno'
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
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <h1 className="text-lg font-semibold">Miembros</h1>
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
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <h1 className="text-lg font-semibold text-peligro">
            No tienes permiso para administrar los miembros
          </h1>
          <p className="mt-2 max-w-prose text-sm text-texto-tenue">
            Admitir gente al coro y cambiar su rol es trabajo del director.
          </p>
          <Link
            href="/repertorio"
            className="mt-6 inline-block text-sm text-acento underline underline-offset-2"
          >
            Volver al repertorio
          </Link>
        </main>
      </>
    )
  }

  const perfiles = await perfilesConVinculo(sesion.coroActivo.id)
  const resumen = resumenDeMiembros(perfiles)
  // H14: la RLS ya filtra —solo el director del coro las lee—, pero la
  // pantalla no ofrece lo que la matriz no concede (§8.3).
  const fichas = puede(sesion.sujeto, 'ver_ficha_del_coro')
    ? await fichasDelCoro(sesion.coroActivo.id)
    : []

  return (
    <>
      <Cabecera sesion={sesion} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-10">
        <div className="flex items-baseline gap-3 pt-4">
          <Link
            href="/repertorio"
            className="-ml-1 shrink-0 rounded px-1 text-sm text-texto-tenue transition-colors hover:text-texto"
            aria-label="Volver al repertorio"
          >
            ←
          </Link>
          <h1 className="min-w-0 text-[1.375rem] leading-tight font-semibold">Miembros</h1>
        </div>
        <p className="mt-1.5 pl-7 text-xs text-texto-tenue">{sesion.coroActivo.nombre}</p>

        <ListaMiembros
          enElCoro={resumen.enElCoro}
          disponibles={resumen.disponibles}
          directores={resumen.directores}
          yoId={sesion.usuarioId}
          fichas={fichas}
        />
      </main>
    </>
  )
}
