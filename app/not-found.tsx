import Link from 'next/link'
import { clasesBotonIcono } from '@/app/componentes/boton-icono'

export const metadata = { title: 'Página no encontrada · Cantoral' }

/**
 * Una dirección que no existe (rediseño 2026-10-17).
 *
 * Un enlace viejo de WhatsApp a un canto borrado caía en la página 404 de
 * Next, en inglés. Sin cabecera: acá no hay sesión a mano, y la salida es una
 * sola.
 */
export default function NoEncontrada() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-10 pb-10">
      <h1 className="titulo-libro text-[1.75rem] leading-tight">Esta página no existe</h1>
      <p className="mt-2 max-w-prose text-base text-texto-tenue">
        Puede que el enlace esté incompleto o que lo que buscabas ya no esté.
      </p>
      <Link href="/" className={clasesBotonIcono('lleno', 'mt-6 px-5 text-base')}>
        Ir al inicio
      </Link>
    </main>
  )
}
