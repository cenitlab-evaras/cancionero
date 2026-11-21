'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { retirarSugerencia, sugerirCanto } from '../sugerir'
import { yaSugirio, type Sugerencia } from '@/lib/motores/sugerencia'
import { NOMBRE_DE_PARTE, type TipoDeLectura } from '@/lib/motores/lecturas'
import { IconoDesplegar } from '@/app/componentes/iconos'

/**
 * Proponer este canto (H17), con las lecturas de la misa y un «por qué» (H30).
 *
 * VIVE FUERA DE LA ZONA DE LECTURA. El cifrado es el producto (§PRODUCT) y
 * todo lo que no es acorde o letra tiene que justificarse: este control se toca
 * sentado, planificando, no de pie con la guitarra puesta. Por eso va AL PIE del
 * canto (rediseño 2026-10-17) — antes iba arriba y era lo primero tocable de la
 * pantalla, con el primer acorde a 224 px — y no en la barra inferior, que es la
 * que se usa MIENTRAS se canta.
 *
 * Sin el halo en el botón: en la lectura lo único cálido es el acorde.
 *
 * EL ALCANCE ES UN SELECTOR Y NO DOS BOTONES porque el dueño pidió las dos
 * cosas: proponer «para Comunión» en general y proponer «para el domingo 20».
 * Son propuestas distintas —la base las guarda en dos filas y las cuenta en dos
 * rankings—, así que la pantalla tiene que dejar decir cuál de las dos es.
 *
 * EL PORQUÉ SOLO EXISTE CON MISA (H30). Proponer en general no tiene un
 * «porqué»: es un dato sobre qué domingo se va a cantar, así que la base lo
 * vuelve imposible también por acción directa. Al elegir una misa se muestran
 * sus lecturas y el campo; si ya la propuso para esa misa, el campo trae su nota
 * y el botón pasa a «Guardar por qué» (el retiro queda como acción secundaria).
 */
export default function Sugerir({
  cantoId,
  momentos,
  misasProximas,
  mias,
  lecturasPorMisa,
}: {
  cantoId: string
  momentos: { id: string; nombre: string }[]
  /** Las que todavía no ocurrieron; una lista sin fecha también sirve. */
  misasProximas: { id: string; nombre: string; fecha: string | null }[]
  mias: Sugerencia[]
  /** Las partes de cada misa próxima (solo tipo, cita y texto), por id. */
  lecturasPorMisa: Record<
    string,
    { tipo: TipoDeLectura; referencia: string; texto: string }[]
  >
}) {
  const router = useRouter()
  const [momentoId, setMomentoId] = useState(momentos[0]?.id ?? '')
  const [misaId, setMisaId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()
  // El porqué se lee del DOM al tocar el botón: no hay dos copias que mantener.
  const cajaNota = useRef<HTMLTextAreaElement>(null)

  // Un canto sin momento asignado no se puede proponer: la propuesta ES para un
  // momento. Se calla en vez de mostrar un control que no puede funcionar.
  if (momentos.length === 0) return null

  const alcance = misaId === '' ? null : misaId
  const mia = mias.find(
    (s) => s.cantoId === cantoId && s.momentoId === momentoId && s.misaId === alcance
  )
  const puesta = !!mia
  // El porqué es solo de la misa: la propuesta general no lleva campo.
  const lecturasDeLaMisa = alcance !== null ? (lecturasPorMisa[alcance] ?? []) : []

  function correr(accion: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    empezar(async () => {
      const r = await accion()
      if (!r.ok) {
        setError(r.error ?? 'No pudimos guardar.')
        return
      }
      router.refresh()
    })
  }

  function payload() {
    const valor = cajaNota.current?.value ?? ''
    return {
      cantoId,
      momentoId,
      misaId: alcance,
      nota: alcance !== null && valor.trim() !== '' ? valor : null,
    }
  }

  // Con la general, el botón conserva lo de siempre: proponer o retirar. Con
  // misa, cuando ya está puesta el botón deja de ser «retirar» y pasa a guardar
  // el porqué — el retiro queda como acción secundaria, para no perderlo.
  const esRetirar = puesta && alcance === null
  const etiqueta = esRetirar ? 'Retirar' : puesta ? 'Guardar por qué' : 'Proponer'

  return (
    <section>
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="text-texto-tenue">Proponerlo para</span>

        {momentos.length === 1 ? (
          <span className="text-texto">{momentos[0]!.nombre}</span>
        ) : (
          <select
            value={momentoId}
            onChange={(e) => setMomentoId(e.target.value)}
            aria-label="Para qué momento lo propones"
            className="tactil rounded-lg border border-borde-fuerte bg-superficie px-2 text-sm"
          >
            {momentos.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        )}

        {misasProximas.length > 0 && (
          <select
            value={misaId}
            onChange={(e) => setMisaId(e.target.value)}
            aria-label="Para cuándo lo propones"
            className="tactil rounded-lg border border-borde-fuerte bg-superficie px-2 text-sm"
          >
            <option value="">en general</option>
            {misasProximas.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nombre}
              </option>
            ))}
          </select>
        )}

        <button
          type="button"
          disabled={pendiente}
          onClick={() => correr(() => (esRetirar ? retirarSugerencia(payload()) : sugerirCanto(payload())))}
          className={`tactil ml-auto rounded-lg px-3 text-sm disabled:opacity-40 ${
            esRetirar
              ? 'text-texto-tenue hover:text-texto'
              : 'border border-borde-fuerte bg-superficie font-bold text-texto hover:bg-superficie-alta'
          }`}
        >
          {etiqueta}
        </button>
      </div>

      {/* Se dice lo que ya está propuesto con OTRO alcance, porque es la
          confusión inevitable de haber pedido las dos cosas: alguien la propone
          en general, cambia el selector a una misa y el botón vuelve a decir
          «Proponer» como si no hubiera hecho nada. */}
      {!puesta && yaSugirio(mias, cantoId, momentoId, null) && alcance !== null && (
        <p className="mt-1.5 text-sm text-texto-tenue">Ya lo propusiste en general.</p>
      )}

      {/* H30 · Al elegir una misa, qué se lee en ella (plegado) y el porqué. La
          propuesta general no lleva ninguna de las dos cosas. */}
      {alcance !== null && (
        <div className="mt-2 flex flex-col gap-2">
          {lecturasDeLaMisa.length > 0 && (
            <details className="group rounded-lg border border-borde bg-superficie">
              <summary className="tactil flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm text-texto-tenue [&::-webkit-details-marker]:hidden">
                <span className="flex-1">Lecturas de esta misa</span>
                <IconoDesplegar className="shrink-0 text-texto-tenue transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" />
              </summary>
              <ul className="px-3 pb-2 text-sm text-texto-tenue">
                {lecturasDeLaMisa.map((l) => (
                  <li key={l.tipo} className="py-1">
                    <span className="text-texto">{NOMBRE_DE_PARTE[l.tipo]}</span>
                    {l.referencia ? ` · ${l.referencia}` : ''}
                    {l.tipo === 'evangelio' && l.texto && (
                      <span className="mt-0.5 block text-texto-tenue">
                        «{l.texto.trim().split('\n')[0]}»
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-texto-tenue">Por qué lo proponés (opcional)</span>
            <textarea
              // La clave lo remonta al cambiar de momento o de misa: cada
              // propuesta trae SU nota, no la que se estaba escribiendo para otra.
              key={`${momentoId}·${alcance}`}
              ref={cajaNota}
              defaultValue={mia?.nota ?? ''}
              maxLength={280}
              rows={2}
              placeholder="Porque el evangelio de este domingo habla de…"
              className="rounded-lg border border-borde-fuerte bg-superficie px-3 py-2 text-base text-texto transition-colors placeholder:text-texto-tenue hover:border-texto-tenue focus:border-acento"
            />
            <span className="self-end text-xs text-texto-tenue">Hasta 280 caracteres</span>
          </label>

          {puesta && (
            <button
              type="button"
              disabled={pendiente}
              onClick={() => correr(() => retirarSugerencia(payload()))}
              className="tactil self-end rounded-lg px-2 py-1 text-sm text-texto-tenue hover:text-texto disabled:opacity-40"
            >
              Retirar
            </button>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-1.5 text-sm text-peligro">
          {error}
        </p>
      )}
    </section>
  )
}
