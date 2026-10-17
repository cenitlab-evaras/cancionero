import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import Cabecera from '@/app/componentes/cabecera'
import ListaCoros from './lista'

export const metadata = { title: 'Coros · Cantoral' }

/**
 * Elegir el coro activo (PRD §18-3).
 *
 * Un admin ve todos los coros porque la RLS se lo permite, pero no pertenece a
 * ninguno: los gobierna desde Administración (H7). Eso se dice, no se disimula.
 */
export default async function CorosPage() {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  return (
    <>
      <Cabecera sesion={sesion} />
      {/* Destino de primer nivel (se llega desde «Más»): sin flecha de volver. */}
      <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-10">
        <h1 className="titulo-libro text-[1.75rem] leading-tight">Tus coros</h1>

        {sesion.coros.length === 0 ? (
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-texto-tenue">
            {sesion.sujeto.rol === 'admin' ? (
              <>
                No perteneces a ningún coro. Los coros se crean y se gobiernan desde{' '}
                <Link
                  href="/admin/perfiles"
                  className="text-acento underline underline-offset-2"
                >
                  Administración
                </Link>
                .
              </>
            ) : (
              'No perteneces a ningún coro todavía. Pídele a tu director que te agregue.'
            )}
          </p>
        ) : (
          <ListaCoros coros={sesion.coros} activoId={sesion.coroActivo?.id ?? ''} />
        )}
      </main>
    </>
  )
}
