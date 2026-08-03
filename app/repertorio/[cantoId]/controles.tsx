'use client'

import { useRouter } from 'next/navigation'
import { useOptimistic, useTransition } from 'react'
import { normalizarSemitonos } from '@/lib/motores/transponer'
import { guardarPreferencia } from './acciones'
import AutoScroll from './auto-scroll'

/**
 * Barra de lectura: transponer, tamaño de letra y auto scroll.
 *
 * Es el único control del producto que se usa **mientras se toca**: de pie, con
 * la guitarra puesta, con un pulgar. De ahí las tres decisiones de forma:
 *   · fija abajo, donde llega el pulgar;
 *   · 44 px de alto en todo lo tocable, sin excepción;
 *   · la tonalidad al centro, que es el dato que el músico mira de reojo.
 *
 * El indicador central hace de "volver al original": en 360 px no entra un
 * control más, y tocar la tonalidad para resetearla es más directo que buscar
 * otro botón.
 */

const TAMANO_MIN = 14
const TAMANO_MAX = 24
const PASO = 2

const BOTON =
  'tactil flex w-11 items-center justify-center rounded-lg border border-borde-fuerte bg-superficie text-texto hover:bg-superficie-alta active:bg-borde disabled:opacity-40 disabled:hover:bg-superficie'

export default function Controles({
  cantoId,
  coroId,
  transposicion,
  tamanoLetra,
  tonalidadActual,
}: {
  cantoId: string
  coroId: string
  transposicion: number
  tamanoLetra: number
  tonalidadActual: string | null
}) {
  const router = useRouter()
  const [, iniciarTransicion] = useTransition()
  const [optimista, aplicarOptimista] = useOptimistic({ transposicion, tamanoLetra })

  function guardar(siguiente: { transposicion: number; tamanoLetra: number }) {
    iniciarTransicion(async () => {
      aplicarOptimista(siguiente)
      await guardarPreferencia({ cantoId, coroId, ...siguiente })
      router.refresh()
    })
  }

  const transponer = (delta: number) =>
    guardar({
      transposicion: normalizarSemitonos(optimista.transposicion + delta),
      tamanoLetra: optimista.tamanoLetra,
    })

  const cambiarTamano = (delta: number) => {
    const t = Math.min(TAMANO_MAX, Math.max(TAMANO_MIN, optimista.tamanoLetra + delta))
    if (t === optimista.tamanoLetra) return
    guardar({ transposicion: optimista.transposicion, tamanoLetra: t })
  }

  const enOriginal = optimista.transposicion === 0
  const signo =
    optimista.transposicion > 0 ? `+${optimista.transposicion}` : `${optimista.transposicion}`

  return (
    <div className="sticky bottom-0 z-(--z-barra) border-t border-borde bg-fondo/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2 px-3 py-2">
        {/* Transponer: el bloque más importante, y por eso el del centro visual */}
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={() => transponer(-1)} aria-label="Bajar un semitono" className={BOTON}>
            <span className="text-lg leading-none">−</span>
          </button>

          <button
            onClick={() =>
              !enOriginal && guardar({ transposicion: 0, tamanoLetra: optimista.tamanoLetra })
            }
            disabled={enOriginal}
            aria-label={enOriginal ? 'Tonalidad original' : 'Volver a la tonalidad original'}
            className="tactil flex min-w-14 flex-col items-center justify-center rounded-lg px-1 disabled:cursor-default"
          >
            <span className="font-cifrado text-lg leading-none font-bold text-acorde">
              {tonalidadActual ?? '—'}
            </span>
            <span className="mt-0.5 text-[0.625rem] leading-none text-texto-tenue">
              {enOriginal ? 'original' : `${signo} · volver`}
            </span>
          </button>

          <button onClick={() => transponer(1)} aria-label="Subir un semitono" className={BOTON}>
            <span className="text-lg leading-none">+</span>
          </button>
        </div>

        <AutoScroll />

        {/* Tamaño de letra. No es un ajuste secundario: hay gente en el coro que
            ve poco y este control es su forma de usar la app (PRODUCT.md). */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => cambiarTamano(-PASO)}
            aria-label={`Achicar la letra, ahora en ${optimista.tamanoLetra} píxeles`}
            disabled={optimista.tamanoLetra <= TAMANO_MIN}
            className={`${BOTON} !w-9 text-xs`}
          >
            A
          </button>
          <button
            onClick={() => cambiarTamano(PASO)}
            aria-label={`Agrandar la letra, ahora en ${optimista.tamanoLetra} píxeles`}
            disabled={optimista.tamanoLetra >= TAMANO_MAX}
            className={`${BOTON} !w-9 text-lg`}
          >
            A
          </button>
        </div>
      </div>
    </div>
  )
}
