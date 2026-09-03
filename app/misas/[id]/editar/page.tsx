import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { cantosDisponibles, obtenerMisa } from '@/lib/datos/misas'
import Cabecera from '@/app/componentes/cabecera'
import Armador from './armador'
import { sugerenciasDeMisa, sugerenciasGenerales } from '@/lib/datos/sugerencias'
import { rankear } from '@/lib/motores/sugerencia'

export const metadata = { title: 'Armar la misa · Cantoral' }

export default async function EditarMisaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  const { id } = await params
  const misa = await obtenerMisa(id)

  if (!misa) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <h1 className="text-lg font-semibold text-peligro">
            No tienes acceso a esta misa
          </h1>
          <Link
            href="/misas"
            className="mt-6 inline-block text-sm text-acento underline underline-offset-2"
          >
            Volver a las misas
          </Link>
        </main>
      </>
    )
  }

  // La pantalla no decide seguridad: consulta la matriz para no ofrecer lo que
  // la server action va a rechazar igual (PRD §8.3).
  if (!puede(sesion.sujeto, 'asignar_cantos_misa')) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <h1 className="text-lg font-semibold text-peligro">
            No tienes permiso para armar esta misa
          </h1>
          <p className="mt-2 max-w-prose text-sm text-texto-tenue">
            Asignar los cantos de la misa es trabajo del director del coro.
          </p>
          <Link
            href={`/misas/${id}`}
            className="mt-6 inline-block text-sm text-acento underline underline-offset-2"
          >
            Ver la misa
          </Link>
        </main>
      </>
    )
  }

  const [deEstaMisa, generales] = await Promise.all([
    sugerenciasDeMisa(id),
    sugerenciasGenerales(misa.coroId),
  ])

  const disponibles = await cantosDisponibles(
    misa.coroId,
    misa.cantos.map((c) => c.cantoId)
  )

  return (
    <>
      <Cabecera sesion={sesion} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-10">
        <div className="flex items-baseline gap-3 pt-4">
          <Link
            href={`/misas/${misa.id}`}
            className="-ml-1 shrink-0 rounded px-1 text-sm text-texto-tenue transition-colors hover:text-texto"
            aria-label="Volver a la misa"
          >
            ←
          </Link>
          <h1 className="min-w-0 text-[1.375rem] leading-tight font-semibold text-balance">
            {misa.nombre}
          </h1>
        </div>
        <p className="mt-1.5 pl-7 text-xs text-texto-tenue">
          Los cantos se acomodan solos según su momento. Puedes moverlos si prefieres otro orden.
        </p>

        <Armador
          misaId={misa.id}
          asignados={misa.cantos}
          disponibles={disponibles}
          sugerenciasDeEstaMisa={rankear(deEstaMisa)}
          sugerenciasGenerales={rankear(generales)}
        />
      </main>
    </>
  )
}
