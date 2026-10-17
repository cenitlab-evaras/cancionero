'use client'

import { useState } from 'react'
import { BotonIcono } from './boton-icono'
import { IconoBuscar, IconoCerrar } from './iconos'

/**
 * El título de una sección con su lupa (el dueño, 2026-10-17: «solo una lupa
 * para buscar»). Cerrada, la fila es el título y una lupa de 44 px; abierta, el
 * campo ocupa el lugar del título, que sigue para los lectores de pantalla.
 *
 * Busca en lo que la SECCIÓN ofrece —cantos en el repertorio, opciones en
 * «Más»—: qué hacer con el término lo decide quien la usa (`alCambiar`).
 *
 * El campo va en `text-base`: con menos de 16 px, Safari de iPhone agranda la
 * página al enfocarlo. La fila mide lo mismo abierta y cerrada (`min-h-11`),
 * para que la lista de abajo no salte.
 */
export default function TituloConLupa({
  titulo,
  valor,
  alCambiar,
  etiqueta,
  muestra,
}: {
  titulo: string
  valor: string
  alCambiar: (termino: string) => void
  /** Nombre accesible del campo y de la lupa: «Buscar en el repertorio». */
  etiqueta: string
  /** El texto de muestra, corto: a 360 px el largo se corta. */
  muestra: string
}) {
  // Con una búsqueda en curso (por ejemplo `?q=` en la URL) se abre abierta.
  const [abierta, setAbierta] = useState(valor !== '')

  function cerrar() {
    alCambiar('')
    setAbierta(false)
  }

  if (!abierta) {
    return (
      <div className="flex min-h-11 items-center justify-between gap-3">
        <h1 className="titulo-libro text-[1.75rem] leading-tight">{titulo}</h1>
        <BotonIcono etiqueta={etiqueta} onClick={() => setAbierta(true)}>
          <IconoBuscar />
        </BotonIcono>
      </div>
    )
  }

  return (
    <div className="flex min-h-11 items-center gap-2">
      <h1 className="sr-only">{titulo}</h1>
      <div className="relative min-w-0 flex-1">
        <IconoBuscar
          tamano={18}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-tenue"
        />
        <input
          type="search"
          // Se abre porque alguien tocó la lupa: el foco va al campo.
          autoFocus
          value={valor}
          onChange={(e) => alCambiar(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') cerrar()
          }}
          placeholder={muestra}
          aria-label={etiqueta}
          className="h-11 w-full rounded-lg border border-borde-fuerte bg-superficie pr-3 pl-10 text-base transition-colors placeholder:text-texto-tenue hover:border-texto-tenue focus:border-acento"
        />
      </div>
      <BotonIcono etiqueta="Cerrar la búsqueda" onClick={cerrar}>
        <IconoCerrar />
      </BotonIcono>
    </div>
  )
}
