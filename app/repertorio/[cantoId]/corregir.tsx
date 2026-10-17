'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  aplicarCorreccion,
  pasosPosibles,
  ubicarAcordes,
  type Correccion,
} from '@/lib/motores/corregir-acorde'
import { renderizarCifrado } from '@/lib/motores/renderizar-cifrado'
import { corregirAcorde } from './acciones'
import { useDiagramas } from './diagramas'

/**
 * «Corregir este acorde» — H19-B, el gesto que decidió §18-15.
 *
 * Tocar un acorde sigue abriendo los diagramas, como en H5: no se inventó un
 * gesto nuevo. Si quien mira puede editar el canto, la hoja suma esta fila bajo
 * la tira, y corrige LA aparición que se tocó —su ordinal—, no todas las que
 * se llaman igual.
 *
 * El panel PREPARA la corrección y la guarda de una vez. Si cada flecha
 * guardara, correr un acorde tres sílabas dejaría tres versiones en el
 * historial de H19-A. La vista previa sale del mismo motor que usa la action,
 * sobre el cifrado tal como se ve (ya transpuesto), así que lo que se muestra
 * es lo que se guarda.
 *
 * Solo lo monta `page.tsx` cuando `puede(sujeto, 'editar_canto')`: el miembro
 * ve los diagramas y nada más. La action lo vuelve a comprobar, y la RLS
 * después de ella.
 */

type Modo = 'cambiar' | 'agregar' | 'borrar'

const BOTON =
  'tactil flex items-center justify-center rounded-lg border border-borde-fuerte bg-superficie text-texto hover:bg-superficie-alta active:bg-borde disabled:opacity-40 disabled:hover:bg-superficie'

/** Columnas de la vista previa: a 13 px caben en los 328 px útiles de un teléfono de 360. */
const COLUMNAS_PREVIA = 36

export default function CorregirAcorde({
  cantoId,
  cifrado,
  transposicion,
}: {
  cantoId: string
  /** El cifrado COMO SE VE: ya transpuesto. */
  cifrado: string
  transposicion: number
}) {
  const { tocado } = useDiagramas()
  if (tocado === null) return null
  // La `key` reinicia el panel al tocar otra aparición o al transponer: el
  // nombre escrito estaba en otro tono y ya no significa lo mismo.
  return (
    <Panel
      key={`${tocado}·${transposicion}`}
      cantoId={cantoId}
      cifrado={cifrado}
      transposicion={transposicion}
      indice={tocado}
    />
  )
}

function Panel({
  cantoId,
  cifrado,
  transposicion,
  indice,
}: {
  cantoId: string
  cifrado: string
  transposicion: number
  indice: number
}) {
  const { cerrar } = useDiagramas()
  const ubicados = useMemo(() => ubicarAcordes(cifrado), [cifrado])
  const ref = ubicados[indice]

  const [abierto, setAbierto] = useState(false)
  const [modo, setModo] = useState<Modo>('cambiar')
  const [nombre, setNombre] = useState(ref?.acorde ?? '')
  const [pasos, setPasos] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [guardando, iniciar] = useTransition()

  if (!ref) return null

  const correccion: Correccion =
    modo === 'borrar'
      ? { tipo: 'borrar', indice }
      : modo === 'agregar'
        ? { tipo: 'agregar', despuesDe: indice, acorde: nombre, pasos }
        : { tipo: 'cambiar', indice, acorde: nombre, pasos }

  const resultado = aplicarCorreccion(cifrado, correccion)
  const limites = pasosPosibles(cifrado, indice, { nuevo: modo === 'agregar' })
  const primeroDeLaLinea = ubicados.findIndex((u) => u.linea === ref.linea)

  function cambiarModo(m: Modo) {
    setModo(m)
    setPasos(0)
    setError(null)
    setNombre(m === 'agregar' ? '' : ref.acorde)
  }

  function guardar() {
    setError(null)
    iniciar(async () => {
      const r = await corregirAcorde({
        cantoId,
        transposicion,
        vista: cifrado,
        correccion,
      })
      if (r.ok) cerrar()
      else setError(r.error)
    })
  }

  if (!abierto) {
    return (
      <div className="border-t border-borde px-4 py-1">
        <button
          onClick={() => setAbierto(true)}
          className="tactil flex w-full items-center gap-2 text-left text-sm text-texto-tenue transition-colors hover:text-texto"
        >
          <span aria-hidden>✎</span>
          Corregir este acorde
          <span className="font-cifrado font-semibold text-acorde">{ref.acorde}</span>
        </button>
      </div>
    )
  }

  // Qué se resalta en cada línea de la vista previa: el acorde tocado antes, y
  // donde quedó después. Al borrar, en «queda» no hay nada que señalar.
  const resaltadoAntes = modo === 'agregar' ? null : indice - primeroDeLaLinea
  const resaltadoDespues =
    resultado.ok && resultado.indice !== null ? resultado.indice - primeroDeLaLinea : null

  // Escribiendo el nombre del nuevo, todavía no hay error que mostrar: falta.
  const aviso = resultado.ok
    ? null
    : modo === 'agregar' && nombre.trim() === ''
      ? 'Escribe el acorde nuevo.'
      : resultado.error

  return (
    <section
      aria-label="Corregir el acorde"
      className="space-y-3 border-t border-borde px-4 pt-2 pb-3"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          Corregir <span className="font-cifrado text-acorde">{ref.acorde}</span>
        </h2>
        <button
          onClick={() => setAbierto(false)}
          className="tactil px-2 text-xs text-texto-tenue hover:text-texto"
        >
          Cancelar
        </button>
      </div>

      <div role="radiogroup" aria-label="Qué hacer" className="grid grid-cols-3 gap-1">
        {(
          [
            ['cambiar', 'Cambiar o mover'],
            ['agregar', 'Agregar al lado'],
            ['borrar', 'Borrar'],
          ] as const
        ).map(([m, etiqueta]) => (
          <button
            key={m}
            role="radio"
            aria-checked={modo === m}
            onClick={() => cambiarModo(m)}
            className={`${BOTON} px-1 text-xs ${modo === m ? '!border-acento !bg-superficie-alta' : ''}`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {modo !== 'borrar' && (
        <div className="flex items-center gap-1">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{modo === 'agregar' ? 'Acorde nuevo' : 'Acorde'}</span>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder={modo === 'agregar' ? 'p. ej. B7 o SIm' : undefined}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={20}
              className="tactil w-full rounded-lg border border-borde-fuerte bg-fondo px-3 font-cifrado text-base text-acorde placeholder:text-texto-tenue/60"
            />
          </label>
          <button
            onClick={() => setPasos((p) => p - 1)}
            disabled={pasos <= -limites.izquierda}
            aria-label="Una sílaba a la izquierda"
            className={`${BOTON} w-11`}
          >
            ←
          </button>
          <button
            onClick={() => setPasos((p) => p + 1)}
            disabled={pasos >= limites.derecha}
            aria-label="Una sílaba a la derecha"
            className={`${BOTON} w-11`}
          >
            →
          </button>
        </div>
      )}

      <div className="space-y-1 rounded-lg bg-fondo px-3 py-2">
        <LineaPrevia
          etiqueta="Antes"
          linea={resultado.ok ? resultado.lineaAntes : lineaCruda(cifrado, ref.linea)}
          resaltado={resaltadoAntes}
        />
        {resultado.ok && (
          <LineaPrevia
            etiqueta="Queda"
            linea={resultado.lineaDespues}
            resaltado={resaltadoDespues}
          />
        )}
      </div>

      {(aviso || error) && (
        <p role="status" className={`text-xs ${error ? 'text-peligro' : 'text-texto-tenue'}`}>
          {error ?? aviso}
        </p>
      )}

      <button
        onClick={guardar}
        disabled={!resultado.ok || guardando}
        className="tactil w-full rounded-lg bg-acento text-sm font-semibold text-white disabled:opacity-40"
      >
        {guardando ? 'Guardando…' : 'Guardar corrección'}
      </button>
    </section>
  )
}

function lineaCruda(cifrado: string, linea: number): string {
  return cifrado.split('\n')[linea] ?? ''
}

/**
 * Una línea del cifrado en chico, con el acorde en cuestión marcado. Usa el
 * mismo motor de render que la pantalla: la vista previa no puede alinear
 * distinto de como después se va a leer.
 */
function LineaPrevia({
  etiqueta,
  linea,
  resaltado,
}: {
  etiqueta: string
  linea: string
  resaltado: number | null
}) {
  const { lineas } = renderizarCifrado(linea, { ancho: COLUMNAS_PREVIA })
  return (
    <div>
      <span className="text-[0.625rem] tracking-[0.08em] text-texto-tenue uppercase">
        {etiqueta}
      </span>
      <div className="font-cifrado text-[13px] leading-snug">
        {lineas.map((l, i) => {
          let cursor = 0
          return (
            <div key={i}>
              <div className="whitespace-pre font-semibold text-acorde">
                {l.acordes.map((a) => {
                  const relleno = ' '.repeat(Math.max(0, a.columnaPintada - cursor))
                  cursor = a.columnaPintada + a.acorde.length
                  return (
                    <span key={a.indice}>
                      {relleno}
                      <span
                        className={
                          a.indice === resaltado
                            ? 'rounded-sm bg-acento/30 outline outline-1 outline-acento'
                            : ''
                        }
                      >
                        {a.acorde}
                      </span>
                    </span>
                  )
                })}
                {l.acordes.length === 0 && ' '}
              </div>
              <div className="whitespace-pre text-texto">{l.texto || ' '}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
