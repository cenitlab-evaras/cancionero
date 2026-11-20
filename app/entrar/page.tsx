import Image from 'next/image'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { rutaInicial } from '@/lib/permisos'
import FormularioEntrar from './formulario'

export const metadata = { title: 'Entrar · Cantoral' }

/**
 * La entrada, sin discurso (el dueño, 2026-11-20: «no quiero el texto de
 * arriba ni el de abajo; solo abajo powered by CenitLab con su logo»).
 * Queda el formulario y, al pie, la firma de la casa.
 */
export default async function EntrarPage() {
  const sesion = await obtenerSesion()
  if (sesion) redirect(rutaInicial(sesion.sujeto))

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col px-6 py-12">
      <div className="flex flex-1 flex-col justify-center">
        <FormularioEntrar />
      </div>

      <footer className="flex items-center justify-center gap-2 pt-10 text-sm text-texto-tenue">
        <span>powered by</span>
        <a
          href="https://cenitlab.cl"
          target="_blank"
          rel="noreferrer"
          aria-label="Cenit Lab"
          className="inline-flex items-center rounded transition-opacity hover:opacity-80"
        >
          {/* Dos versiones del logo oficial: la clara para el tema oscuro y la
              oscura para el claro. Se muestra una sola según `data-tema`. */}
          <Image
            src="/cenitlab/logo-horizontal-rev-1120.png"
            alt=""
            width={1120}
            height={340}
            className="h-7 w-auto claro:hidden"
          />
          <Image
            src="/cenitlab/logo-horizontal-1120.png"
            alt=""
            width={1120}
            height={340}
            className="hidden h-7 w-auto claro:block"
          />
        </a>
      </footer>
    </main>
  )
}
