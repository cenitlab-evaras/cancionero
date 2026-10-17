'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { clasesBotonIcono } from '@/app/componentes/boton-icono'

/**
 * Cuando una pantalla falla (rediseño 2026-10-17).
 *
 * Antes salía la pantalla de error de Next, en inglés y en blanco, en medio de
 * una app oscura: en plena misa eso es lo peor que puede aparecer. Acá se dice
 * qué hacer, en el tono de la app, y se ofrecen las dos salidas que sirven.
 *
 * `unstable_retry` y no `reset`: en esta versión de Next es el que vuelve a
 * pedir los datos al servidor antes de redibujar, que es lo que arregla un
 * corte de red (ver `node_modules/next/dist/docs/.../error.md`).
 *
 * Sin la cabecera: el error puede venir justo de armar la sesión.
 */
export default function ErrorDePantalla({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-10 pb-10">
      <h1 className="titulo-libro text-[1.75rem] leading-tight">Algo falló</h1>
      <p className="mt-2 max-w-prose text-base text-texto-tenue">
        No pudimos mostrar esta pantalla. Revisa que tengas conexión y vuelve a intentarlo.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className={clasesBotonIcono('lleno', 'px-5 text-base')}
        >
          Reintentar
        </button>
        <Link href="/" className={clasesBotonIcono('borde', 'px-5 text-base')}>
          Ir al inicio
        </Link>
      </div>
    </main>
  )
}
