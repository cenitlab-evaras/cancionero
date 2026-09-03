'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { agregarCanto, moverCanto, quitarCanto } from '../../acciones'
import type { CantoDeMisa } from '@/lib/datos/misas'
import type { FilaDelRanking } from '@/lib/motores/sugerencia'

import { recomendar, type Candidato } from '@/lib/motores/recomendacion'
import { describirAntiguedad } from '@/lib/motores/historial'
import type { CantoDisponible } from '@/lib/datos/misas'

type Disponible = CantoDisponible

/**
 * Armar la misa: agregar un canto por momento, moverlo y quitarlo.
 *
 * Ninguna decisión de orden vive acá — la toma el motor puro del lado del
 * servidor. Esto es solo el pegamento: llamar la acción y refrescar.
 */
export default function Armador({
  misaId,
  asignados,
  disponibles,
  sugerenciasDeEstaMisa,
  sugerenciasGenerales,
  hoy,
}: {
  misaId: string
  asignados: CantoDeMisa[]
  disponibles: Disponible[]
  /** El día del coro, no el del servidor (§17.1-octies). */
  hoy: string
  /* H17 · DOS listas y no una. Lo que el coro pidió PARA ESTE DOMINGO y lo que
     el coro quiere cantar EN GENERAL contestan preguntas distintas; sumarlas
     daría un número que no responde ninguna (§17, §18-12). Van separadas, y
     primero la concreta: alguien la pidió para esta misa. */
  sugerenciasDeEstaMisa: FilaDelRanking[]
  sugerenciasGenerales: FilaDelRanking[]
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()

  function correr(accion: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    empezar(async () => {
      const r = await accion()
      if (!r.ok) setError(r.error ?? 'No pudimos guardar el cambio.')
      router.refresh()
    })
  }

  // Agrupado por momento para que el director busque como piensa la misa.
  const porMomento = disponibles.reduce<Record<string, Disponible[]>>((acc, c) => {
    ;(acc[c.momentoNombre] ??= []).push(c)
    return acc
  }, {})

  /**
   * H18 · dentro de cada momento, primero lo que hace más tiempo que no se
   * canta, y los nunca cantados aparte. El orden lo decide el motor; acá solo
   * se dibuja lo que devolvió.
   */
  function ordenados(cantos: Disponible[]) {
    const { hacenFalta, nuncaCantados } = recomendar(
      cantos.map((c): Candidato => ({
        cantoId: c.id,
        titulo: c.titulo,
        estado: c.estado,
        ultima: c.ultima,
      })),
      hoy
    )
    const deId = new Map(cantos.map((c) => [c.id, c]))
    return [
      ...hacenFalta.map((r) => ({
        canto: deId.get(r.cantoId)!,
        cuando: describirAntiguedad(r.diasDesdeUltima),
      })),
      ...nuncaCantados.map((r) => ({
        canto: deId.get(r.cantoId)!,
        cuando: 'nunca se cantó',
      })),
    ]
  }

  return (
    <div className={pendiente ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      {error && <p className="mt-4 text-sm text-peligro">{error}</p>}

      <h2 className="mt-6 text-[0.8125rem] font-semibold text-texto-tenue uppercase">
        En la misa
      </h2>

      {asignados.length === 0 ? (
        <p className="mt-2 text-sm text-texto-tenue">
          Todavía no hay cantos. Agrega uno de la lista de abajo.
        </p>
      ) : (
        <ol className="mt-2 divide-y divide-borde border-t border-borde">
          {asignados.map((c, i) => (
            <li key={c.id} className="flex min-h-14 items-center gap-2 py-2">
              <span className="w-5 shrink-0 text-right font-cifrado text-xs text-texto-tenue">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{c.titulo}</span>
                <span className="block text-xs text-texto-tenue">{c.momentoNombre}</span>
              </span>

              <button
                onClick={() =>
                  correr(() => moverCanto({ misaId, filaId: c.id, direccion: 'arriba' }))
                }
                disabled={i === 0 || pendiente}
                aria-label={`Subir ${c.titulo}`}
                className="tactil w-9 rounded-lg text-texto-tenue disabled:opacity-25"
              >
                ↑
              </button>
              <button
                onClick={() =>
                  correr(() => moverCanto({ misaId, filaId: c.id, direccion: 'abajo' }))
                }
                disabled={i === asignados.length - 1 || pendiente}
                aria-label={`Bajar ${c.titulo}`}
                className="tactil w-9 rounded-lg text-texto-tenue disabled:opacity-25"
              >
                ↓
              </button>
              <button
                onClick={() => correr(() => quitarCanto({ misaId, filaId: c.id }))}
                disabled={pendiente}
                aria-label={`Quitar ${c.titulo} de la misa`}
                // La única acción destructiva del producto tiene el único color
                // de peligro (PRD §11.1). Quitar de una misa no borra el
                // canto del repertorio.
                className="tactil w-9 rounded-lg text-peligro disabled:opacity-25"
              >
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}

      {[
        { titulo: 'Pedido para esta misa', filas: sugerenciasDeEstaMisa },
        { titulo: 'Lo que el coro propone', filas: sugerenciasGenerales },
      ].map(
        ({ titulo, filas }) =>
          filas.length > 0 && (
            <section key={titulo} className="mt-10">
              <h2 className="text-[0.8125rem] font-semibold text-texto-tenue uppercase">
                {titulo}
              </h2>
              <ul className="mt-2 divide-y divide-borde border-t border-borde">
                {filas.map((f) => {
                  const yaEsta = asignados.some((a) => a.cantoId === f.cantoId)
                  return (
                    <li key={`${f.cantoId}·${f.momentoId}`} className="py-2">
                      <div className="flex items-baseline gap-3">
                        <span className="min-w-0 flex-1 truncate text-sm">{f.titulo}</span>
                        <span className="shrink-0 font-cifrado text-sm text-acorde">
                          {f.cuantas}
                        </span>
                        {yaEsta ? (
                          // No se ofrece agregar lo que ya está: la acción
                          // fallaría con «ese canto ya está en la misa», y un
                          // botón que se sabe que va a fallar no se dibuja.
                          <span className="shrink-0 text-xs text-texto-tenue">ya está</span>
                        ) : (
                          <button
                            onClick={() =>
                              correr(() =>
                                agregarCanto({
                                  misaId,
                                  cantoId: f.cantoId,
                                  momentoId: f.momentoId,
                                })
                              )
                            }
                            disabled={pendiente}
                            aria-label={`Agregar ${f.titulo} en ${f.momentoNombre}`}
                            className="tactil shrink-0 px-2 text-acento disabled:opacity-40"
                          >
                            +
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-texto-tenue">
                        {f.momentoNombre} · {f.quienes.join(', ')}
                      </p>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
      )}

      <h2 className="mt-10 text-[0.8125rem] font-semibold text-texto-tenue uppercase">
        Agregar del repertorio
      </h2>

      {disponibles.length === 0 ? (
        <p className="mt-2 text-sm text-texto-tenue">
          Todos los cantos del repertorio ya están en esta misa.
        </p>
      ) : (
        Object.entries(porMomento).map(([momento, cantos]) => (
          <section key={momento} className="mt-4">
            <h3 className="text-[0.8125rem] font-semibold text-texto-tenue">{momento}</h3>
            <ul className="mt-1 divide-y divide-borde border-t border-borde">
              {ordenados(cantos).map(({ canto: c, cuando }) => (
                <li key={`${c.id}-${c.momentoId}`}>
                  <button
                    onClick={() =>
                      correr(() =>
                        agregarCanto({ misaId, cantoId: c.id, momentoId: c.momentoId })
                      )
                    }
                    disabled={pendiente}
                    className="tactil flex w-full items-center gap-3 text-left text-sm transition-colors hover:bg-superficie disabled:opacity-40"
                  >
                    <span className="min-w-0 flex-1 truncate">{c.titulo}</span>
                    {/* H18 · el dato que el director NO puede calcular de
                        memoria, y la razón por la que el orden es el que es. */}
                    <span className="shrink-0 text-xs text-texto-tenue">{cuando}</span>
                    <span className="shrink-0 text-acento">+</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  )
}
