import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { cantosArchivados } from '@/lib/datos/repertorio'
import Cabecera from '@/app/componentes/cabecera'
import { EnlaceIcono, clasesBotonIcono } from '@/app/componentes/boton-icono'
import { IconoVolver } from '@/app/componentes/iconos'
import ListaArchivados from './lista'

export const metadata = { title: 'Archivados · Cantoral' }

/**
 * Los cantos que salieron de circulación (§16, cerrado el 2026-09-03).
 *
 * Vive bajo `/repertorio` y no en la barra de abajo: se consulta al planificar,
 * no mientras se toca, igual que el historial de H13. Desde el rediseño del
 * 2026-10-17 se entra por «Más» —antes era un enlace al pie del repertorio—,
 * así que es de segundo nivel y su volver lleva ahí.
 */
export default async function ArchivadosPage() {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  // Las dos capas de §15-4: la pantalla no se ofrece, y por URL tampoco entra.
  if (!puede(sesion.sujeto, 'archivar_canto') || !sesion.coroActivo) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <h1 className="text-lg font-semibold text-peligro">
            No tienes permiso para ver los cantos archivados
          </h1>
          <p className="mt-2 max-w-prose text-sm text-texto-tenue">
            Sacar un canto del repertorio y devolverlo es trabajo del director del coro.
          </p>
          <Link href="/repertorio" className={clasesBotonIcono('borde', 'mt-6 px-4')}>
            Volver al repertorio
          </Link>
        </main>
      </>
    )
  }

  const cantos = await cantosArchivados(sesion.coroActivo.id)

  return (
    <>
      <Cabecera sesion={sesion} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-10">
        <div className="-ml-3 flex items-center gap-1">
          <EnlaceIcono href="/mas" etiqueta="Volver a Más">
            <IconoVolver />
          </EnlaceIcono>
          <h1 className="titulo-libro min-w-0 text-[1.75rem] leading-tight">Cantos archivados</h1>
        </div>

        {cantos.length === 0 ? (
          // Un estado vacío explica POR QUÉ está vacío (PRD §14).
          <div className="mt-4">
            <p className="max-w-prose text-texto-tenue">
              No hay ningún canto archivado. Cuando saques uno del repertorio desde «Editar», va a
              aparecer acá y vas a poder devolverlo.
            </p>
            <Link href="/repertorio" className={clasesBotonIcono('borde', 'mt-5 px-4')}>
              Ir al repertorio
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-2 max-w-prose text-sm text-texto-tenue">
              Fuera del repertorio y de la búsqueda. Siguen en las misas donde se cantaron y en el
              historial.
            </p>
            <ListaArchivados cantos={cantos} />
          </>
        )}
      </main>
    </>
  )
}
