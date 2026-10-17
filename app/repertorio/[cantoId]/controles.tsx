'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useOptimistic, useState, useTransition } from 'react'
import { normalizarSemitonos } from '@/lib/motores/transponer'
import { TAMANO_MAX, TAMANO_MIN, cambiarTamano } from '@/lib/motores/tamano-letra'
import { BotonIcono } from '@/app/componentes/boton-icono'
import { IconoAgregar, IconoPausa, IconoQuitar, IconoReproducir } from '@/app/componentes/iconos'
import { guardarTamanoLetra, guardarTransposicion } from './acciones'
import { Velocidad, useAutoScroll } from './auto-scroll'

/**
 * Barra de lectura: transponer, desplazar solo y tamaño de letra.
 *
 * Es el único control del producto que se usa **mientras se toca**: de pie, con
 * la guitarra puesta, con un pulgar. De ahí sus reglas:
 *   · fija abajo, donde llega el pulgar;
 *   · 44 px en todo lo tocable, sin excepción (antes A−/A+ medían 36 de ancho);
 *   · a lo sumo cinco controles a la vez.
 *
 * Por eso, con el desplazamiento andando, la velocidad ocupa el lugar de
 * transponer: en 360 px no entraban los dos y el deslizador quedaba de 25 px,
 * imposible de usar con el pulgar. Nadie cambia de tono mientras la pantalla
 * baja sola; al pausar, vuelve transponer.
 *
 * El tamaño de letra es de la PERSONA (2026-10-17): lo que se elige acá vale
 * para todos los cantos y para toda la misa.
 *
 * Si un guardado falla se dice, abajo y sin tapar el canto. Antes fallaba en
 * silencio y la persona descubría en el canto siguiente que no se había guardado.
 */
export default function Controles({
  cantoId,
  coroId,
  transposicion,
  tamanoLetra,
  tonalidadActual,
  mostrarAcordes = true,
}: {
  cantoId: string
  coroId: string
  transposicion: number
  tamanoLetra: number
  tonalidadActual: string | null
  /**
   * H11 · Con los acordes apagados, transponer no cambia un solo píxel de la
   * pantalla: el bloque entero se retira. La preferencia guardada NO se toca.
   */
  mostrarAcordes?: boolean
}) {
  const router = useRouter()
  const [, iniciarTransicion] = useTransition()
  const [optimista, aplicarOptimista] = useOptimistic({ transposicion, tamanoLetra })
  const [aviso, setAviso] = useState<string | null>(null)
  const scroll = useAutoScroll()

  useEffect(() => {
    if (!aviso) return
    const t = setTimeout(() => setAviso(null), 5000)
    return () => clearTimeout(t)
  }, [aviso])

  function transponer(nueva: number) {
    iniciarTransicion(async () => {
      aplicarOptimista({ ...optimista, transposicion: nueva })
      const r = await guardarTransposicion({ cantoId, coroId, transposicion: nueva })
      if (!r.ok) setAviso(r.error)
      router.refresh()
    })
  }

  function tamano(direccion: 1 | -1) {
    const nuevo = cambiarTamano(optimista.tamanoLetra, direccion)
    if (nuevo === optimista.tamanoLetra) return
    iniciarTransicion(async () => {
      aplicarOptimista({ ...optimista, tamanoLetra: nuevo })
      const r = await guardarTamanoLetra(nuevo)
      if (!r.ok) setAviso(r.error)
      router.refresh()
    })
  }

  const enOriginal = optimista.transposicion === 0
  const signo =
    optimista.transposicion > 0 ? `+${optimista.transposicion}` : `${optimista.transposicion}`

  return (
    // El `sticky` no vive acá: lo pone la pila inferior de la página, para que
    // la hoja de diagramas (H5) pueda apilarse encima de esta barra.
    <div className="border-t border-borde bg-fondo pb-[env(safe-area-inset-bottom)]">
      {aviso && (
        <p role="status" className="mx-auto max-w-2xl px-4 pt-2 text-sm text-peligro">
          {aviso}
        </p>
      )}

      <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-3 py-2">
        <BotonIcono
          etiqueta={scroll.andando ? 'Pausar el desplazamiento' : 'Desplazar solo'}
          apariencia="borde"
          aria-pressed={scroll.andando}
          onClick={scroll.alternar}
          className={scroll.andando ? '!border-texto !bg-superficie-alta' : ''}
        >
          {scroll.andando ? <IconoPausa /> : <IconoReproducir />}
        </BotonIcono>

        {scroll.andando ? (
          <Velocidad velocidad={scroll.velocidad} setVelocidad={scroll.setVelocidad} />
        ) : mostrarAcordes ? (
          // Transponer: la tonalidad al centro, que es el dato que se mira de
          // reojo. Tocarla vuelve al original.
          <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
            <BotonIcono
              etiqueta="Bajar un semitono"
              apariencia="borde"
              onClick={() => transponer(normalizarSemitonos(optimista.transposicion - 1))}
            >
              <IconoQuitar />
            </BotonIcono>

            <button
              type="button"
              onClick={() => !enOriginal && transponer(0)}
              disabled={enOriginal}
              aria-label={
                enOriginal
                  ? `Tonalidad original, ${tonalidadActual ?? 'sin tonalidad'}`
                  : `En ${tonalidadActual}, ${signo} semitonos. Volver a la original`
              }
              className="tactil flex min-w-14 flex-col items-center justify-center rounded-lg px-1 disabled:cursor-default"
            >
              <span className="font-cifrado text-lg leading-none font-bold text-acorde">
                {tonalidadActual ?? '—'}
              </span>
              <span className="mt-1 text-xs leading-none text-texto-tenue">
                {enOriginal ? 'original' : `${signo} · volver`}
              </span>
            </button>

            <BotonIcono
              etiqueta="Subir un semitono"
              apariencia="borde"
              onClick={() => transponer(normalizarSemitonos(optimista.transposicion + 1))}
            >
              <IconoAgregar />
            </BotonIcono>
          </div>
        ) : (
          <span className="flex-1" />
        )}

        {/* Tamaño de letra. No es un ajuste secundario: hay gente en el coro que
            ve poco y este control es su forma de usar la app (PRODUCT.md). */}
        <div className="flex shrink-0 items-center gap-1">
          <BotonIcono
            etiqueta={`Achicar la letra, ahora en ${optimista.tamanoLetra}`}
            apariencia="borde"
            disabled={optimista.tamanoLetra <= TAMANO_MIN}
            onClick={() => tamano(-1)}
          >
            <span className="text-sm font-bold" aria-hidden>
              A
            </span>
          </BotonIcono>
          <BotonIcono
            etiqueta={`Agrandar la letra, ahora en ${optimista.tamanoLetra}`}
            apariencia="borde"
            disabled={optimista.tamanoLetra >= TAMANO_MAX}
            onClick={() => tamano(1)}
          >
            <span className="text-xl font-bold" aria-hidden>
              A
            </span>
          </BotonIcono>
        </div>
      </div>
    </div>
  )
}
