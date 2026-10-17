'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useOptimistic, useState, useTransition } from 'react'
import { normalizarSemitonos } from '@/lib/motores/transponer'
import { TAMANO_MAX, TAMANO_MIN, cambiarTamano } from '@/lib/motores/tamano-letra'
import { BotonIcono } from '@/app/componentes/boton-icono'
import { IconoAgregar, IconoPausa, IconoQuitar, IconoReproducir } from '@/app/componentes/iconos'
import { guardarTamanoLetra, guardarTransposicion } from './acciones'
import { cambiarTono } from '@/app/misas/acciones'
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
  misa,
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
  /**
   * H27 · Dentro de una misa. Con el tono de la misa fijado, ese es el que se
   * ve, y solo el director lo cambia: sus botones escriben la fila de la misa,
   * no su preferencia personal. El resto ve el tono y su origen, sin botones.
   * Sin fijar, la barra es la de siempre: el tono personal.
   */
  misa?: { misaId: string; filaId: string; fijado: boolean; puedeFijar: boolean }
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

  function transponer(nueva: number | null) {
    iniciarTransicion(async () => {
      if (nueva !== null) aplicarOptimista({ ...optimista, transposicion: nueva })
      const r = misa?.puedeFijar
        ? await cambiarTono({ misaId: misa.misaId, filaId: misa.filaId, transposicion: nueva })
        : await guardarTransposicion({ cantoId, coroId, transposicion: nueva ?? 0 })
      if (!r.ok) setAviso(r.error)
      router.refresh()
    })
  }

  // H27 · El tono lo fijó el director para esta misa y quien mira no puede
  // cambiarlo: se muestra, pero sin botones que harían creer que sí.
  const soloVer = !!misa?.fijado && !misa.puedeFijar
  // El director, con el tono fijado: tocar la tonalidad lo quita (vuelve a
  // «cada uno con el suyo»), igual que tocarla fuera de la misa vuelve al original.
  const quitaElDeLaMisa = !!misa?.fijado && misa.puedeFijar

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
            {!soloVer && (
              <BotonIcono
                etiqueta={misa?.puedeFijar ? 'Bajar el tono de la misa' : 'Bajar un semitono'}
                apariencia="borde"
                onClick={() => transponer(normalizarSemitonos(optimista.transposicion - 1))}
              >
                <IconoQuitar />
              </BotonIcono>
            )}

            <button
              type="button"
              onClick={() =>
                quitaElDeLaMisa ? transponer(null) : !enOriginal && !soloVer && transponer(0)
              }
              disabled={soloVer || (enOriginal && !quitaElDeLaMisa)}
              aria-label={
                misa?.fijado
                  ? `Tono de la misa, ${tonalidadActual ?? `${signo} semitonos`}${
                      quitaElDeLaMisa ? '. Quitarlo para que cada uno vea el suyo' : ''
                    }`
                  : enOriginal
                    ? `Tonalidad original, ${tonalidadActual ?? 'sin tonalidad'}`
                    : `En ${tonalidadActual}, ${signo} semitonos. Volver a la original`
              }
              className="tactil flex min-w-14 flex-col items-center justify-center rounded-lg px-1 disabled:cursor-default"
            >
              <span className="font-cifrado text-lg leading-none font-bold text-acorde">
                {tonalidadActual ?? (misa?.fijado ? signo : '—')}
              </span>
              <span className="mt-1 text-xs leading-none text-texto-tenue">
                {misa?.fijado
                  ? quitaElDeLaMisa
                    ? 'de la misa · quitar'
                    : 'de la misa'
                  : enOriginal
                    ? 'original'
                    : `${signo} · volver`}
              </span>
            </button>

            {!soloVer && (
              <BotonIcono
                etiqueta={misa?.puedeFijar ? 'Subir el tono de la misa' : 'Subir un semitono'}
                apariencia="borde"
                onClick={() => transponer(normalizarSemitonos(optimista.transposicion + 1))}
              >
                <IconoAgregar />
              </BotonIcono>
            )}
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
