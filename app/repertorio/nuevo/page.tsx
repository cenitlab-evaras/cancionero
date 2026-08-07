import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { catalogosParaEditar } from '@/lib/datos/repertorio'
import Cabecera from '@/app/componentes/cabecera'
import FormularioCanto from '../formulario-canto'

export const metadata = { title: 'Canto nuevo · Cantoral' }

export default async function NuevoCantoPage() {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  // La pantalla consulta la matriz para no ofrecer un formulario que la RLS va
  // a rechazar igual. La seguridad la deciden la RLS y la action (§8.3).
  if (!puede(sesion.sujeto, 'editar_canto')) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <h1 className="text-lg font-semibold text-peligro">
            No tienes permiso para editar el repertorio
          </h1>
          <p className="mt-2 max-w-prose text-sm text-texto-tenue">
            Cargar y corregir cantos es trabajo del director del coro.
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

  const { momentos, autores } = await catalogosParaEditar()

  return (
    <>
      <Cabecera sesion={sesion} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4">
        <div className="flex items-baseline gap-3 pt-4">
          <Link
            href="/repertorio"
            className="-ml-1 shrink-0 rounded px-1 text-sm text-texto-tenue transition-colors hover:text-texto"
            aria-label="Volver al repertorio"
          >
            ←
          </Link>
          <h1 className="text-[1.375rem] leading-tight font-semibold">Canto nuevo</h1>
        </div>

        <FormularioCanto
          momentos={momentos}
          autoresConocidos={autores}
          inicial={{
            titulo: '',
            autorNombre: '',
            cifrado: '',
            tonalidadOriginal: '',
            momentoIds: [],
            // Un canto nuevo nace `listo`, igual que el default de la columna:
            // lo más común es cargar el que el coro ya canta (H10).
            estado: 'listo',
            fuenteTitulo: '',
            fuenteNumero: '',
            fuentePagina: '',
          }}
        />
      </main>
    </>
  )
}
