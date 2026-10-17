import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { cantosDisponibles, obtenerMisa } from '@/lib/datos/misas'
import Cabecera from '@/app/componentes/cabecera'
import { EnlaceIcono } from '@/app/componentes/boton-icono'
import { IconoVolver } from '@/app/componentes/iconos'
import Armador from './armador'
import { sugerenciasDeMisa, sugerenciasGenerales } from '@/lib/datos/sugerencias'
import { rankear } from '@/lib/motores/sugerencia'
import { hoyISO } from '@/lib/datos/historial'

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
        <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-10">
          <h1 className="titulo-libro text-[1.75rem] leading-tight text-peligro">
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
        <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-10">
          <h1 className="titulo-libro text-[1.75rem] leading-tight text-peligro">
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
        <div className="-ml-3 pt-2">
          <EnlaceIcono href={`/misas/${misa.id}`} etiqueta="Volver a la misa">
            <IconoVolver />
          </EnlaceIcono>
        </div>
        <h1 className="titulo-libro mt-1 text-[1.75rem] leading-tight text-balance">
          {misa.nombre}
        </h1>
        <p className="mt-1 max-w-prose text-sm text-texto-tenue">
          Los cantos se acomodan solos según su momento. Puedes moverlos si prefieres otro orden.
        </p>

        <Armador
          misaId={misa.id}
          asignados={misa.cantos}
          disponibles={disponibles}
          hoy={hoyISO()}
          sugerenciasDeEstaMisa={rankear(deEstaMisa)}
          sugerenciasGenerales={rankear(generales)}
        />
      </main>
    </>
  )
}
