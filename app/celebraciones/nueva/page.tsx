import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import Cabecera from '@/app/componentes/cabecera'
import FormularioCelebracion from './formulario'

export const metadata = { title: 'Nueva celebración · Cantoral' }

export default async function NuevaCelebracionPage() {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  // La interfaz consulta la matriz; la RLS y la server action deciden de verdad
  // (PRD §8.3). Acá se evita mostrar un formulario que no va a poder guardar.
  if (!puede(sesion.sujeto, 'editar_celebracion')) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <h1 className="text-lg font-semibold text-peligro">
            No tienes permiso para crear celebraciones
          </h1>
          <p className="mt-2 max-w-prose text-sm text-texto-tenue">
            Armar la misa es trabajo del director del coro.
          </p>
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

  return (
    <>
      <Cabecera sesion={sesion} />
      <main className="mx-auto w-full max-w-md flex-1 px-4 py-8">
        <h1 className="text-lg font-semibold">Nueva celebración</h1>
        <p className="mt-1 text-sm text-texto-tenue">
          Después le asignas un canto por momento.
        </p>
        <FormularioCelebracion />
      </main>
    </>
  )
}
