import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { rutaInicial } from '@/lib/permisos'
import FormularioEntrar from './formulario'

export const metadata = { title: 'Entrar · Cantoral' }

export default async function EntrarPage() {
  const sesion = await obtenerSesion()
  if (sesion) redirect(rutaInicial(sesion.sujeto))

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
      {/* La identidad es tipográfica, no un logo: el producto es un instrumento,
          y su marca es la misma monoespaciada con la que se lee el cifrado. */}
      <h1 className="font-cifrado text-2xl font-bold tracking-tight">Cantoral</h1>
      <p className="mt-2 text-sm text-texto-tenue">El repertorio de tu coro, en tu teléfono.</p>

      <FormularioEntrar />

      <p className="mt-10 text-xs leading-relaxed text-texto-tenue">
        Si es tu primera vez, un administrador tiene que habilitar tu cuenta y tu director agregarte
        al coro.
      </p>
    </main>
  )
}
