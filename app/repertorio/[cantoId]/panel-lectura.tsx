'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { EnlaceIcono, clasesBotonIcono } from '@/app/componentes/boton-icono'
import { IconoDesplegar } from '@/app/componentes/iconos'

/**
 * Los controles de la lectura, pedidos (maqueta «Teleprompter», 2026-11-18).
 *
 * La pantalla es de la letra: abajo no hay barra fija. Se abre tocando un
 * BORDE de la pantalla o el botón de arriba a la derecha; se cierra tocando
 * afuera, con Esc, o con el mismo botón.
 *
 * Se oculta con transform, NO se desmonta: el auto scroll vive adentro de
 * `Controles`, y esconder la barra no puede detener la letra que avanza sola.
 * Mientras está cerrada queda `inert`, así el teclado y el lector de pantalla
 * no caen en controles que no se ven.
 */
export default function PanelLectura({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false)

  useEffect(() => {
    if (!abierto) return
    const fuera = (e: PointerEvent) => {
      // Los botones del cifrado no cuentan como «afuera»: abren los diagramas.
      if ((e.target as HTMLElement).closest('[data-panel-lectura], [data-acorde]')) return
      setAbierto(false)
    }
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && setAbierto(false)
    document.addEventListener('pointerdown', fuera)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('pointerdown', fuera)
      document.removeEventListener('keydown', tecla)
    }
  }, [abierto])

  return (
    <>
      {/* El botón de arriba: el camino con teclado y lector de pantalla. */}
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-expanded={abierto}
        aria-label={abierto ? 'Ocultar los controles del canto' : 'Mostrar los controles del canto'}
        className={`fixed top-1 right-2 z-(--z-cabecera) ${clasesBotonIcono(abierto ? 'activo' : 'plano')}`}
      >
        <IconoDesplegar />
      </button>

      {/* Los bordes: el gesto del pulgar. Invisibles salvo su hebra. */}
      {!abierto && (
        <>
          <button
            type="button"
            aria-label="Mostrar los controles del canto"
            onClick={() => setAbierto(true)}
            className="fixed top-16 bottom-16 left-0 z-(--z-cabecera) w-4"
          >
            <span
              aria-hidden
              className="absolute top-1/2 left-1 h-12 w-[3px] -translate-y-1/2 rounded bg-superficie-alta"
            />
          </button>
          <button
            type="button"
            aria-label="Mostrar los controles del canto"
            onClick={() => setAbierto(true)}
            className="fixed top-16 right-0 bottom-16 z-(--z-cabecera) w-4"
          >
            <span
              aria-hidden
              className="absolute top-1/2 right-1 h-12 w-[3px] -translate-y-1/2 rounded bg-superficie-alta"
            />
          </button>
        </>
      )}

      <div
        data-panel-lectura
        aria-hidden={!abierto}
        // `inert` en React se pasa como booleano; sin él, tab entra a lo oculto.
        inert={!abierto}
        className={`border-t border-borde bg-fondo transition-transform duration-200 ease-out ${
          abierto ? '' : 'pointer-events-none translate-y-full'
        }`}
      >
        {children}
      </div>
    </>
  )
}

/** Un enlace con ícono para la fila de herramientas del panel. */
export function HerramientaDelPanel({
  href,
  etiqueta,
  children,
}: {
  href: string
  etiqueta: string
  children: ReactNode
}) {
  return (
    <EnlaceIcono href={href} etiqueta={etiqueta}>
      {children}
    </EnlaceIcono>
  )
}
