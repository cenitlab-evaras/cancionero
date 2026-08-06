import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { corosDeLaInstalacion, perfilesConVinculo } from '@/lib/datos/gobierno'
import Cabecera from '@/app/componentes/cabecera'
import PanelAdmin from './panel'

export const metadata = { title: 'Administración · Cantoral' }

/**
 * El portón, del lado de adentro (H7 · §8.4).
 *
 * Hasta este hito, aprobar una cuenta o crear un coro solo se podía escribiendo
 * SQL a mano. Es la pantalla que convierte el producto en algo que puede
 * recibir a alguien de verdad.
 */
export default async function AdminPerfilesPage() {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  if (!puede(sesion.sujeto, 'aprobar_perfil')) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <h1 className="text-lg font-semibold text-peligro">Esta pantalla es de administración</h1>
          <p className="mt-2 max-w-prose text-sm text-texto-tenue">
            Aprobar cuentas y crear coros es trabajo de un administrador de la instalación.
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

  // El coro activo solo se usa para saber el vínculo; al admin le interesan
  // todos los perfiles, pertenezcan donde pertenezcan.
  const [perfiles, coros] = await Promise.all([
    perfilesConVinculo(sesion.coroActivo?.id ?? '00000000-0000-0000-0000-000000000000'),
    corosDeLaInstalacion(),
  ])

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
          <h1 className="min-w-0 text-[1.375rem] leading-tight font-semibold">Administración</h1>
        </div>

        <PanelAdmin perfiles={perfiles} coros={coros} yoId={sesion.usuarioId} />
      </main>
    </>
  )
}
