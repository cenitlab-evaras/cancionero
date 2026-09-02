import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { miFicha } from '@/lib/datos/ficha'
import { hoyISO } from '@/lib/datos/historial'
import { edadEn } from '@/lib/motores/ficha'
import Cabecera from '@/app/componentes/cabecera'
import FormularioFicha from './formulario'

export const metadata = { title: 'Mi perfil · Cantoral' }

/**
 * H14 · el perfil propio.
 *
 * Pantalla nueva y no una sección de ajustes: H11 evitó crear una por un solo
 * interruptor, pero tres campos propios ya la justifican.
 */
export default async function MiFichaPage() {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  if (!sesion.coroActivo) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <h1 className="text-lg font-semibold">Mi perfil</h1>
          <p className="mt-2 text-sm text-texto-tenue">
            Todavía no perteneces a ningún coro. El perfil se carga por coro,
            porque tu disponibilidad puede ser distinta en cada uno.
          </p>
        </main>
      </>
    )
  }

  // La matriz decide qué se ofrece; la RLS decide qué entra (§8.3).
  if (!puede(sesion.sujeto, 'editar_ficha_propia')) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <h1 className="text-lg font-semibold text-peligro">
            No tienes permiso para cargar tu perfil
          </h1>
          <Link href="/repertorio" className="mt-4 inline-block text-sm underline">
            Volver al repertorio
          </Link>
        </main>
      </>
    )
  }

  const ficha = await miFicha(sesion.coroActivo.id)
  // La edad se calcula al leer, contra el día del coro. No existe la columna.
  const edad = edadEn(ficha?.fechaNacimiento ?? null, hoyISO())

  return (
    <>
      <Cabecera sesion={sesion} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-10">
        {/* Mismo patrón de vuelta que Miembros e Historial: la flecha primero,
            el título después. Sin ella esta era la única pantalla sin salida
            propia. */}
        <div className="flex items-baseline gap-3 pt-4">
          <Link
            href="/repertorio"
            className="-ml-1 shrink-0 rounded px-1 text-sm text-texto-tenue transition-colors hover:text-texto"
            aria-label="Volver al repertorio"
          >
            ←
          </Link>
          <h1 className="min-w-0 text-[1.375rem] leading-tight font-semibold">Mi perfil</h1>
        </div>
        <p className="mt-1.5 max-w-prose pl-7 text-sm text-texto-tenue">
          Tus datos en {sesion.coroActivo.nombre}. Los ve tu director para armar
          las voces y saber con quién cuenta. Nadie más del coro los ve.
          {edad !== null && <> Hoy tienes <strong>{edad} años</strong>.</>}
        </p>

        <FormularioFicha ficha={ficha} />
      </main>
    </>
  )
}
