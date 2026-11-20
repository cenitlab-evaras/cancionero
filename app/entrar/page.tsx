import Image from 'next/image'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { rutaInicial } from '@/lib/permisos'
import EscudoCoro from '@/app/componentes/escudo-coro'
import FormularioEntrar from './formulario'

export const metadata = { title: 'Entrar · Cantoral' }

// La instalación sirve a un coro: su logo y su nombre son la identidad de la
// entrada (el dueño, 2026-11-20). Cuando el producto sirva a varios coros,
// esto pasa a ser una lectura pública de la marca de la instalación.
const CORO_DE_LA_INSTALACION = {
  id: '1d1319ec-d4f4-4e2d-8672-271294cd20e3',
  nombre: 'Coro San José de la Familia',
}

/**
 * La entrada, sin discurso (el dueño, 2026-11-20: «no quiero el texto de
 * arriba ni el de abajo»). Arriba, el logo y el nombre del coro; después el
 * formulario; al pie, la firma de la casa.
 */
export default async function EntrarPage() {
  const sesion = await obtenerSesion()
  if (sesion) redirect(rutaInicial(sesion.sujeto))

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col px-6 py-12">
      <div className="flex flex-1 flex-col justify-center">
        <header className="mb-8 flex flex-col items-center gap-3 text-center">
          <EscudoCoro
            coroId={CORO_DE_LA_INSTALACION.id}
            nombre={CORO_DE_LA_INSTALACION.nombre}
            tamano={72}
          />
          <p className="titulo-libro text-[1.5rem] leading-tight">{CORO_DE_LA_INSTALACION.nombre}</p>
        </header>

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
