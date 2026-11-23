'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useOptimistic, useState, useTransition } from 'react'
import { normalizarSemitonos } from '@/lib/motores/transponer'
import { BotonIcono, EnlaceIcono, clasesBotonIcono } from '@/app/componentes/boton-icono'
import {
  IconoAcordes,
  IconoAgregar,
  IconoListo,
  IconoPausa,
  IconoQuitar,
  IconoReproducir,
  IconoSeguir,
  IconoVolver,
} from '@/app/componentes/iconos'
import HojaTamano from '@/app/componentes/hoja-tamano'
import { guardarMostrarAcordes, guardarTransposicion } from './acciones'
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
  sinAutoScroll = false,
  sinTamano = false,
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
  /**
   * La ejecución de la misa (H31) lleva el auto-scroll y el Aa en su barra fija
   * de cuatro acciones. Ahí este panel deja de dibujarlos para no ofrecer dos
   * veces el mismo control; la transposición sigue viviendo acá.
   */
  sinAutoScroll?: boolean
  sinTamano?: boolean
}) {
  const router = useRouter()
  const [, iniciarTransicion] = useTransition()
  const [optimista, aplicarOptimista] = useOptimistic({ transposicion, tamanoLetra })
  const [aviso, setAviso] = useState<string | null>(null)
  // La hoja del tamaño de letra (2026-11-17): un control con su valor en vez
  // de dos «A» que no decían en qué tamaño estaba la persona.
  const [ajustando, setAjustando] = useState(false)
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

  const enOriginal = optimista.transposicion === 0
  const signo =
    optimista.transposicion > 0 ? `+${optimista.transposicion}` : `${optimista.transposicion}`

  return (
    // El `sticky` no vive acá: lo pone la pila inferior de la página, para que
    // la hoja de diagramas (H5) pueda apilarse encima de esta barra.
    <div className="border-t border-borde bg-fondo">
      {aviso && (
        <p role="status" className="mx-auto max-w-2xl px-4 pt-2 text-sm text-peligro">
          {aviso}
        </p>
      )}

      <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-3 py-2">
        {!sinAutoScroll && (
          <BotonIcono
            etiqueta={scroll.andando ? 'Pausar el desplazamiento' : 'Desplazar solo'}
            apariencia="borde"
            aria-pressed={scroll.andando}
            onClick={scroll.alternar}
            className={scroll.andando ? '!border-texto !bg-superficie-alta' : ''}
          >
            {scroll.andando ? <IconoPausa /> : <IconoReproducir />}
          </BotonIcono>
        )}

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
              <span className="mt-1 text-sm leading-none text-texto-tenue">
                {misa?.fijado
                  ? quitaElDeLaMisa
                    ? 'misa · quitar'
                    : 'misa'
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
            ve poco y este control es su forma de usar la app (PRODUCT.md).
            Desde H31 es UN botón «Aa» con el píxel del preset a la vista, y
            abre la hoja de tres presets; antes eran dos «A» sin número que
            obligaban a tocar cinco veces (y la barra pasaba de cinco controles).
            En la ejecución de la misa el Aa vive en la barra fija: `sinTamano`. */}
        {!sinTamano && (
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setAjustando(true)}
              aria-haspopup="dialog"
              aria-expanded={ajustando}
              aria-label={`Tamaño de letra, ahora en ${tamanoLetra} píxeles`}
              className={`tactil flex h-11 items-center justify-center gap-1 rounded-lg border border-borde-fuerte px-2.5 text-sm font-bold ${
                ajustando ? 'border-texto bg-superficie-alta' : ''
              }`}
            >
              <span aria-hidden>Aa</span>
              <span className="tabular-nums">{tamanoLetra}</span>
            </button>
            <HojaTamano
              abierto={ajustando}
              onCerrar={() => setAjustando(false)}
              actual={tamanoLetra}
            />
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * El interruptor de acordes de la barra del lector (H11), en ícono.
 *
 * `SoloLetra` —el de la lectura del repertorio— lleva su texto «Acordes» al
 * lado; en la barra de la ejecución no entra con los otros tres íconos. Misma
 * preferencia y misma acción (`guardarMostrarAcordes`), así que se alterna desde
 * cualquiera de las dos pantallas. El tachado dice «solo letra» sin depender
 * del color.
 */
export function BotonAcordes({ mostrarAcordes }: { mostrarAcordes: boolean }) {
  const router = useRouter()
  const [, iniciarTransicion] = useTransition()
  const [optimista, aplicarOptimista] = useOptimistic(mostrarAcordes)

  function alternar() {
    iniciarTransicion(async () => {
      aplicarOptimista(!optimista)
      await guardarMostrarAcordes(!optimista)
      // Se vuelve a leer siempre: si el guardado falló, el ícono regresa al
      // estado real en vez de quedarse mintiendo.
      router.refresh()
    })
  }

  return (
    <BotonIcono
      // El nombre dice el ESTADO, no la acción, igual que `SoloLetra`: con
      // `aria-pressed`, el lector anuncia «Ver acordes, activado/desactivado».
      etiqueta="Ver acordes"
      apariencia={optimista ? 'activo' : 'plano'}
      aria-pressed={optimista}
      onClick={alternar}
    >
      <span className="relative">
        <IconoAcordes />
        {!optimista && (
          <span
            aria-hidden
            className="absolute top-1/2 left-1/2 h-[1.75px] w-7 -translate-x-1/2 -translate-y-1/2 -rotate-45 rounded bg-current"
          />
        )}
      </span>
    </BotonIcono>
  )
}

/**
 * La barra fija del lector de una tarea (H31): anterior · Aa · auto · siguiente.
 *
 * Es la única barra que se usa de pie, con el pulgar, a mitad de la misa: los
 * cuatro controles son de 44 px y no hay scroll horizontal a 360. El
 * auto-scroll es el MISMO hook de `auto-scroll.tsx` (`useAutoScroll`); con el
 * desplazamiento andando aparece arriba su velocidad, para no perder el control
 * que antes vivía en el panel.
 *
 * El panel (`PanelLectura`) sigue existiendo para transponer, y por eso
 * `Controles` se monta con `sinAutoScroll` y `sinTamano`: acá no se duplica
 * ningún control.
 */
export function BarraLector({
  misaId,
  anterior,
  siguiente,
  tamanoLetra,
}: {
  misaId: string
  anterior: string | null
  siguiente: string | null
  tamanoLetra: number
}) {
  const scroll = useAutoScroll()
  const [hoja, setHoja] = useState(false)

  return (
    <div className="border-t border-borde bg-fondo pb-[env(safe-area-inset-bottom)]">
      {scroll.andando && (
        <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-4 pt-1">
          <Velocidad velocidad={scroll.velocidad} setVelocidad={scroll.setVelocidad} />
        </div>
      )}

      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-1 px-2 py-1">
        {anterior ? (
          <EnlaceIcono href={`/misas/${misaId}/${anterior}`} etiqueta="Canto anterior">
            <IconoVolver />
          </EnlaceIcono>
        ) : (
          <span aria-hidden className={clasesBotonIcono('plano', 'opacity-30')}>
            <IconoVolver />
          </span>
        )}

        <BotonIcono
          etiqueta={`Tamaño de letra, ahora en ${tamanoLetra} píxeles`}
          aria-haspopup="dialog"
          aria-expanded={hoja}
          onClick={() => setHoja(true)}
          className="px-2"
        >
          <span aria-hidden className="text-base font-bold">
            Aa
          </span>
        </BotonIcono>

        <BotonIcono
          etiqueta={scroll.andando ? 'Pausar el desplazamiento' : 'Desplazar solo'}
          apariencia={scroll.andando ? 'activo' : 'plano'}
          aria-pressed={scroll.andando}
          onClick={scroll.alternar}
        >
          {scroll.andando ? <IconoPausa /> : <IconoReproducir />}
        </BotonIcono>

        {siguiente ? (
          <EnlaceIcono href={`/misas/${misaId}/${siguiente}`} etiqueta="Siguiente canto">
            <IconoSeguir />
          </EnlaceIcono>
        ) : (
          <EnlaceIcono href={`/misas/${misaId}`} etiqueta="Terminar la misa">
            <IconoListo />
          </EnlaceIcono>
        )}
      </div>

      <HojaTamano abierto={hoja} onCerrar={() => setHoja(false)} actual={tamanoLetra} />
    </div>
  )
}
