import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { cantoParaEditar, catalogosParaEditar, vecesEnMisas } from '@/lib/datos/repertorio'
import Cabecera from '@/app/componentes/cabecera'
import { EnlaceIcono, clasesBotonIcono } from '@/app/componentes/boton-icono'
import { IconoVolver } from '@/app/componentes/iconos'
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
          <Link href={`/repertorio/${cantoId}`} className={clasesBotonIcono('borde', 'mt-6 px-4')}>
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
          <Link href="/repertorio" className={clasesBotonIcono('borde', 'mt-6 px-4')}>
            Volver al repertorio
          </Link>
        </main>
      </>
    )
  }

  return (
    <>
      <Cabecera sesion={sesion} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6">
        {/* Segundo nivel: se vuelve al canto, que es desde donde se entra. El
            título ya no se trunca: un canto largo partido en dos líneas se lee
            entero, cortado con «…» no se sabe cuál se está editando. */}
        <div className="-ml-3 flex items-center gap-1">
          <EnlaceIcono href={`/repertorio/${cantoId}`} etiqueta="Volver al canto">
            <IconoVolver />
          </EnlaceIcono>
          <h1 className="titulo-libro min-w-0 text-[1.75rem] leading-tight">{canto.titulo}</h1>
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
