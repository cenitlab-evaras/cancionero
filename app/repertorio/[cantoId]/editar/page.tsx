import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { cantoParaEditar, catalogosParaEditar, vecesEnMisas } from '@/lib/datos/repertorio'
import Cabecera from '@/app/componentes/cabecera'
import FormularioCanto from '../../formulario-canto'
import Archivar from './archivar'

export const metadata = { title: 'Editar canto · Cantoral' }

export default async function EditarCantoPage({
  params,
}: {
  params: Promise<{ cantoId: string }>
}) {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  const { cantoId } = await params

  if (!puede(sesion.sujeto, 'editar_canto')) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <h1 className="text-lg font-semibold text-peligro">
            No tienes permiso para editar el repertorio
          </h1>
          <p className="mt-2 max-w-prose text-sm text-texto-tenue">
            Corregir un canto es trabajo del director del coro. Sí puedes ajustar tu propia
            transposición y el tamaño de letra desde la vista de lectura.
          </p>
          <Link
            href={`/repertorio/${cantoId}`}
            className="mt-6 inline-block text-sm text-acento underline underline-offset-2"
          >
            Ver el canto
          </Link>
        </main>
      </>
    )
  }

  const [canto, { momentos, autores }, enMisas] = await Promise.all([
    cantoParaEditar(cantoId),
    catalogosParaEditar(),
    vecesEnMisas(cantoId),
  ])

  // Cero filas por RLS no es un canto vacío: es falta de acceso (§14).
  if (!canto) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <h1 className="text-lg font-semibold text-peligro">No tienes acceso a este canto</h1>
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

  return (
    <>
      <Cabecera sesion={sesion} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4">
        <div className="flex items-baseline gap-3 pt-4">
          <Link
            href={`/repertorio/${cantoId}`}
            className="-ml-1 shrink-0 rounded px-1 text-sm text-texto-tenue transition-colors hover:text-texto"
            aria-label="Volver al canto"
          >
            ←
          </Link>
          <h1 className="min-w-0 truncate text-[1.375rem] leading-tight font-semibold">
            {canto.titulo}
          </h1>
        </div>

        <FormularioCanto
          cantoId={canto.id}
          momentos={momentos}
          autoresConocidos={autores}
          inicial={{
            titulo: canto.titulo,
            autorNombre: canto.autorNombre,
            cifrado: canto.cifrado,
            tonalidadOriginal: canto.tonalidadOriginal,
            momentoIds: canto.momentoIds,
            estado: canto.estado,
            fuenteTitulo: canto.fuenteTitulo,
            fuenteNumero: canto.fuenteNumero,
            fuentePagina: canto.fuentePagina,
          }}
        />

        {/* Archivar cuelga de la edición y no de la vista de lectura: sacar un
            canto del repertorio es una decisión que se toma mirándolo entero,
            sentado, no mientras se toca. Y no se ofrece sobre uno que ya está
            archivado — para eso está /repertorio/archivados. */}
        {puede(sesion.sujeto, 'archivar_canto') && canto.estado !== 'archivado' && (
          <Archivar cantoId={canto.id} enMisas={enMisas} />
        )}
      </main>
    </>
  )
}
