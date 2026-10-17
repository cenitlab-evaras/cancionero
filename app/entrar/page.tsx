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
      {/* La identidad sigue siendo tipográfica, no un logo —el logo es del coro,
          y acá todavía no se sabe de cuál—, pero desde el rediseño del
          2026-10-17 es la serif del libro, no la monoespaciada del cifrado:
          Cantoral es un cancionero antes que un instrumento. */}
      <h1 className="titulo-libro text-[2.25rem] leading-tight">Cantoral</h1>
      <p className="mt-2 text-base text-texto-tenue">
        El cancionero de tu coro en el teléfono: los cantos con sus acordes, en el tono que
        necesitas, y la misa del domingo armada.
      </p>

      <FormularioEntrar />

      <div className="mt-10 space-y-2 text-sm leading-relaxed text-texto-tenue">
        <p className="font-semibold text-texto">¿No tienes cuenta?</p>
        <p>
          Pídesela al director de tu coro. Después, un administrador la habilita y tu director te
          agrega al coro.
        </p>
      </div>
    </main>
  )
}
