import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { miFicha } from '@/lib/datos/ficha'
import { hoyISO } from '@/lib/datos/historial'
import { preferenciasDelPerfil } from '@/lib/datos/repertorio'
import { edadEn } from '@/lib/motores/ficha'
import Cabecera from '@/app/componentes/cabecera'
import FormularioFicha from './formulario'
import TamanoLetra from './tamano-letra'

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

  // El tamaño de letra es de la persona, no del coro (RN-14): sale aunque no
  // haya coro activo ni permiso para la ficha. Solo depende de poder guardar
  // una preferencia propia, que es lo que la action exige.
  const tamano = puede(sesion.sujeto, 'guardar_preferencia_propia') ? (
    <TamanoLetra tamanoLetra={(await preferenciasDelPerfil()).tamanoLetra} />
  ) : null

  // Destino de primer nivel (se llega desde «Más»): sin flecha de volver.
  const titulo = <h1 className="titulo-libro text-[1.75rem] leading-tight">Mi perfil</h1>

  if (!sesion.coroActivo) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-10">
          {titulo}
          <p className="mt-2 max-w-prose text-sm text-texto-tenue">
            Todavía no perteneces a ningún coro. Tu cuerda y cuándo puedes cantar se cargan por
            coro, porque pueden ser distintas en cada uno.
          </p>
          {tamano}
        </main>
      </>
    )
  }

  // La matriz decide qué se ofrece; la RLS decide qué entra (§8.3).
  if (!puede(sesion.sujeto, 'editar_ficha_propia')) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-10">
          {titulo}
          <p className="mt-2 max-w-prose text-sm text-texto-tenue">
            Tu cuenta no puede cargar su ficha en este coro.
          </p>
          <Link
            href="/repertorio"
            className="mt-4 inline-block text-sm text-acento underline underline-offset-2"
          >
            Ir al repertorio
          </Link>
          {tamano}
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
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-10">
        {titulo}
        <p className="mt-1 max-w-prose text-sm text-texto-tenue">
          Tus datos en {sesion.coroActivo.nombre}. Los ve tu director para armar
          las voces y saber con quién cuenta. Nadie más del coro los ve.
          {edad !== null && <> Hoy tienes <strong className="text-texto">{edad} años</strong>.</>}
        </p>

        <FormularioFicha ficha={ficha} />
        {tamano}
      </main>
    </>
  )
}
