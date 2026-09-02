import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { miFicha } from '@/lib/datos/ficha'
import { hoyISO } from '@/lib/datos/historial'
import { edadEn } from '@/lib/motores/ficha'
import Cabecera from '@/app/componentes/cabecera'
import FormularioFicha from './formulario'

export const metadata = { title: 'Mi ficha · Cantoral' }

/**
 * H14 · la ficha propia.
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
          <h1 className="text-lg font-semibold">Mi ficha</h1>
          <p className="mt-2 text-sm text-texto-tenue">
            Todavía no perteneces a ningún coro. La ficha se carga por coro,
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
            No tienes permiso para cargar tu ficha
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
      <main className="mx-auto w-full max-w-2xl px-4 py-8">
        <h1 className="text-lg font-semibold">Mi ficha</h1>
        <p className="mt-1 max-w-prose text-sm text-texto-tenue">
          Tus datos en {sesion.coroActivo.nombre}. Los ve tu director para armar
          las voces y saber con quién cuenta. Nadie más del coro los ve.
          {edad !== null && <> Hoy tienes <strong>{edad} años</strong>.</>}
        </p>

        <FormularioFicha ficha={ficha} />
      </main>
    </>
  )
}
