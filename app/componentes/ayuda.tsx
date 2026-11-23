'use client'

import { useEffect, useRef, useState } from 'react'
import { BotonIcono } from './boton-icono'
import { IconoAyuda, IconoCerrar } from './iconos'

/**
 * La hoja «Cómo leer» (rediseño de lectura, H31).
 *
 * Las instrucciones no se muestran sueltas en la pantalla: viven detrás del
 * «?» y se cierran con la X. Es texto fijo —no lee nada— porque explica cómo
 * funciona la app, no qué hay en el coro.
 *
 * El `<dialog>` nativo se encarga del foco, del fondo inerte y de Escape; la
 * hoja se apoya abajo, como una bandeja, y sube a la altura de su contenido.
 */

const ITEMS = [
  ['Empezar', 'Abre el primer canto y te deja en el lector.'],
  ['Barra de abajo', 'Anterior, Aa, auto-scroll y siguiente, siempre a la vista.'],
  ['Aa', 'Pequeño, Regular o Grande. Se guarda para vos.'],
  ['Acordes', 'La nota musical muestra u oculta los acordes.'],
  ['Lecturas y partes', 'El libro abre las lecturas; la lista, los cantos de la misa.'],
  [
    'Contexto',
    'Toca los íconos de coro, complejidad, celebración o lugar: la info aparece debajo y se colapsa sola en unos segundos. La complejidad es baja si todas ya se ensayaron o cantaron, media si varias están en ensayo y alta si son nuevas, sin ensayar. Las barras son una, dos o tres.',
  ],
  [
    'Misas, en calendario',
    'La pestaña Misas abre el mes: cada día con misa marca si tiene lecturas (libro) y propuestas (punto). Toca un día para ver su resumen y abrir la misa.',
  ],
] as const

export default function Ayuda({ etiqueta = 'Cómo leer' }: { etiqueta?: string }) {
  const [abierta, setAbierta] = useState(false)
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (abierta && !dialog.open) dialog.showModal()
    else if (!abierta && dialog.open) dialog.close()
  }, [abierta])

  return (
    <>
      <BotonIcono etiqueta={etiqueta} onClick={() => setAbierta(true)}>
        <IconoAyuda />
      </BotonIcono>

      <dialog
        ref={ref}
        aria-labelledby="ayuda-titulo"
        onCancel={(e) => {
          e.preventDefault()
          setAbierta(false)
        }}
        onClick={(e) => {
          if (e.target === ref.current) setAbierta(false)
        }}
        className="fixed inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border-t border-borde-fuerte bg-superficie p-0 text-texto"
      >
        <div className="mx-auto w-full max-w-2xl">
          <div className="sticky top-0 flex items-center gap-2 border-b border-borde bg-superficie px-4 py-1">
            <h2 id="ayuda-titulo" className="min-w-0 flex-1 text-base font-semibold">
              {etiqueta}
            </h2>
            <BotonIcono etiqueta="Cerrar" onClick={() => setAbierta(false)}>
              <IconoCerrar />
            </BotonIcono>
          </div>

          <div className="px-4 pt-3 pb-6">
            <p className="max-w-prose text-sm text-texto-tenue prosa-equilibrada">
              Todo lo que necesitás para pasar de un canto al siguiente sin salir del lector.
            </p>

            <ul className="mt-4 space-y-3">
              {ITEMS.map(([titulo, texto]) => (
                <li key={titulo}>
                  <strong className="block text-[0.9375rem] font-bold text-texto">{titulo}</strong>
                  <span className="block max-w-prose text-sm text-texto-tenue">{texto}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </dialog>
    </>
  )
}
