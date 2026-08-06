import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { cantosDisponibles, obtenerCelebracion } from '@/lib/datos/celebraciones'
import Cabecera from '@/app/componentes/cabecera'
import Armador from './armador'

export const metadata = { title: 'Armar celebración · Cantoral' }

export default async function EditarCelebracionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  const { id } = await params
  const celebracion = await obtenerCelebracion(id)

  if (!celebracion) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <h1 className="text-lg font-semibold text-peligro">
            No tienes acceso a esta celebración
          </h1>
          <Link
            href="/celebraciones"
            className="mt-6 inline-block text-sm text-acento underline underline-offset-2"
          >
            Volver a las celebraciones
          </Link>
        </main>
      </>
    )
  }

  // La pantalla no decide seguridad: consulta la matriz para no ofrecer lo que
  // la server action va a rechazar igual (PRD §8.3).
  if (!puede(sesion.sujeto, 'asignar_cantos_celebracion')) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <h1 className="text-lg font-semibold text-peligro">
            No tienes permiso para armar esta celebración
          </h1>
          <p className="mt-2 max-w-prose text-sm text-texto-tenue">
            Asignar los cantos de la misa es trabajo del director del coro.
          </p>
          <Link
            href={`/celebraciones/${id}`}
            className="mt-6 inline-block text-sm text-acento underline underline-offset-2"
          >
            Ver la celebración
          </Link>
        </main>
      </>
    )
  }

  const disponibles = await cantosDisponibles(
    celebracion.coroId,
    celebracion.cantos.map((c) => c.cantoId)
  )

  return (
    <>
      <Cabecera sesion={sesion} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-10">
        <div className="flex items-baseline gap-3 pt-4">
          <Link
            href={`/celebraciones/${celebracion.id}`}
            className="-ml-1 shrink-0 rounded px-1 text-sm text-texto-tenue transition-colors hover:text-texto"
            aria-label="Volver a la celebración"
          >
            ←
          </Link>
          <h1 className="min-w-0 text-[1.375rem] leading-tight font-semibold text-balance">
            {celebracion.nombre}
          </h1>
        </div>
        <p className="mt-1.5 pl-7 text-xs text-texto-tenue">
          Los cantos se acomodan solos según su momento. Puedes moverlos si prefieres otro orden.
        </p>

        <Armador
          celebracionId={celebracion.id}
          asignados={celebracion.cantos}
          disponibles={disponibles}
        />
      </main>
    </>
  )
}
