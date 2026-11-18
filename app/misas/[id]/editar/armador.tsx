'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { agregarCanto, cambiarTono, moverCanto, quitarCanto } from '../../acciones'
import { cambiarTonoDeMisa, tonalidadDeLaFila } from '@/lib/motores/tono-en-la-misa'
import type { CantoDeMisa } from '@/lib/datos/misas'
import type { FilaDelRanking } from '@/lib/motores/sugerencia'

import { recomendar, type Candidato } from '@/lib/motores/recomendacion'
import { describirAntiguedad } from '@/lib/motores/historial'
import type { CantoDisponible } from '@/lib/datos/misas'
import TituloSeccion from '@/app/componentes/titulo-seccion'
import { BotonIcono } from '@/app/componentes/boton-icono'
import { IconoAgregar, IconoBajar, IconoQuitar, IconoSubir } from '@/app/componentes/iconos'

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
  momentos,
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
  /** El catálogo de momentos, en orden litúrgico: es el mapa del armado. */
  momentos: { nombre: string; orden: number }[]
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

  /** H27 · `null` quita el tono fijado: cada uno vuelve a ver el suyo. */
  function fijarTono(filaId: string, transposicion: number | null) {
    correr(() => cambiarTono({ misaId, filaId, transposicion }))
  }

  // La misa, POR SEGMENTO (2026-11-18): los cantos se agrupan por momento
  // litúrgico y el director ve cómo se llena cada uno; subir y bajar mueven
  // dentro del segmento (lo resuelve `moverCanto` en la base).
  const grupos = useMemo(() => {
    const lista: { clave: string; nombre: string; orden: number; filas: CantoDeMisa[] }[] = []
    for (const c of asignados) {
      const ultimo = lista.at(-1)
      if (ultimo && ultimo.orden === c.momentoOrden && ultimo.nombre === c.momentoNombre) {
        ultimo.filas.push(c)
      } else {
        lista.push({
          clave: `${c.momentoOrden}·${c.momentoNombre}`,
          nombre: c.momentoNombre,
          orden: c.momentoOrden,
          filas: [c],
        })
      }
    }
    // Asignados llega en el orden guardado; se agrupa respetando el momento.
    return lista.sort((a, b) => a.orden - b.orden)
  }, [asignados])

  // Los segmentos del catálogo que todavía no tienen canto: el mapa de lo que
  // falta, sin obligar a nada (María o Salmos no siempre van).
  const vacios = momentos
    .filter((m) => !asignados.some((c) => c.momentoNombre === m.nombre))
    .map((m) => m.nombre)

  // Agrupado por momento para que el director busque como piensa la misa.
  const porMomento = disponibles.reduce<Record<string, Disponible[]>>((acc, c) => {
    ;(acc[c.momentoNombre] ??= []).push(c)
    return acc
  }, {})

  /**
   * H18 · dentro de cada momento, primero lo que hace más tiempo que no se
   * canta, y los nunca cantados aparte. El orden lo decide el motor; acá solo
   * se dibuja lo que devolvió.
   *
   * Los dos grupos salen separados (rediseño 2026-10-17): «nunca se cantó»
   * repetido en setenta filas era ruido que tapaba el dato útil —hace cuánto
   * se cantó lo demás—. Ahora se dice una vez, como encabezado de su grupo.
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
    return {
      cantados: hacenFalta.map((r) => ({
        canto: deId.get(r.cantoId)!,
        cuando: describirAntiguedad(r.diasDesdeUltima) as string | null,
      })),
      nunca: nuncaCantados.map((r) => ({ canto: deId.get(r.cantoId)!, cuando: null })),
    }
  }

  function filaDisponible({ canto: c, cuando }: { canto: Disponible; cuando: string | null }) {
    return (
      <li key={`${c.id}-${c.momentoId}`}>
        <button
          type="button"
          onClick={() =>
            correr(() => agregarCanto({ misaId, cantoId: c.id, momentoId: c.momentoId }))
          }
          disabled={pendiente}
          aria-label={`Agregar ${c.titulo} en ${c.momentoNombre}`}
          className="tactil -mx-2 flex w-[calc(100%+1rem)] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-superficie disabled:opacity-40"
        >
          <span className="min-w-0 flex-1 truncate">{c.titulo}</span>
          {/* H18 · el dato que el director NO puede calcular de memoria, y
              la razón por la que el orden es el que es. */}
          {cuando && <span className="shrink-0 text-sm text-texto-tenue">{cuando}</span>}
          <IconoAgregar tamano={18} className="shrink-0 text-acento" />
        </button>
      </li>
    )
  }

  return (
    <div className={pendiente ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      {error && (
        <p role="status" className="mt-4 text-sm text-peligro">
          {error}
        </p>
      )}

      <TituloSeccion className="mt-6" detalle={asignados.length > 0 ? String(asignados.length) : undefined}>
        En la misa
      </TituloSeccion>

      {asignados.length === 0 ? (
        <p className="mt-2 text-sm text-texto-tenue">
          Todavía no hay cantos. Agrega uno de la lista de abajo.
        </p>
      ) : (
        grupos.map((g) => (
          <section key={g.clave} className="mt-4">
            {/* El segmento y cuánto tiene: así se ve cómo se llena la misa. */}
            <h3 className="text-sm font-semibold text-texto-tenue">
              {g.nombre} <span className="font-normal">· {g.filas.length}</span>
            </h3>
            <ol className="mt-1 divide-y divide-borde border-t border-borde">
              {/* Subir y bajar juntos, de 44 px y con borde; quitar aparte, sin
                  borde y separado por un hueco: antes eran tres glifos de 36 px
                  pegados y el ✕ rojo quedaba a un dedo del ↓. */}
              {g.filas.map((c, i) => (
                <li key={c.id} className="py-2">
                  <div className="flex min-h-11 items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">{c.titulo}</span>

                    <BotonIcono
                      etiqueta={`Subir ${c.titulo}`}
                      apariencia="borde"
                      onClick={() =>
                        correr(() => moverCanto({ misaId, filaId: c.id, direccion: 'arriba' }))
                      }
                      disabled={i === 0 || pendiente}
                    >
                      <IconoSubir tamano={18} />
                    </BotonIcono>
                    <BotonIcono
                      etiqueta={`Bajar ${c.titulo}`}
                      apariencia="borde"
                      onClick={() =>
                        correr(() => moverCanto({ misaId, filaId: c.id, direccion: 'abajo' }))
                      }
                      disabled={i === g.filas.length - 1 || pendiente}
                    >
                      <IconoBajar tamano={18} />
                    </BotonIcono>
                    <BotonIcono
                      etiqueta={`Quitar ${c.titulo} de la misa`}
                      onClick={() => correr(() => quitarCanto({ misaId, filaId: c.id }))}
                      disabled={pendiente}
                      // La única acción destructiva del producto tiene el único color
                      // de peligro (PRD §11.1). Quitar de una misa no borra el
                      // canto del repertorio.
                      className="ml-3 !text-peligro"
                    >
                      <IconoQuitar tamano={18} />
                    </BotonIcono>
                  </div>

                  {/* H27 · En qué tono va este canto en ESTA misa. Sin fijar, cada
                      uno lo ve en su tono personal; fijado, todos lo ven en este. */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="w-12 shrink-0 text-sm text-texto-tenue">Tono</span>
                    <BotonIcono
                      etiqueta={`Bajar el tono de ${c.titulo} en esta misa`}
                      apariencia="borde"
                      disabled={pendiente}
                      onClick={() => fijarTono(c.id, cambiarTonoDeMisa(c.tonoDeMisa, -1))}
                    >
                      <IconoQuitar tamano={18} />
                    </BotonIcono>
                    <span className="min-w-12 text-center font-cifrado font-bold text-acorde">
                      {tonalidadDeLaFila(c.tonalidadOriginal, c.tonoDeMisa) ?? semitonos(c.tonoDeMisa)}
                    </span>
                    <BotonIcono
                      etiqueta={`Subir el tono de ${c.titulo} en esta misa`}
                      apariencia="borde"
                      disabled={pendiente}
                      onClick={() => fijarTono(c.id, cambiarTonoDeMisa(c.tonoDeMisa, 1))}
                    >
                      <IconoAgregar tamano={18} />
                    </BotonIcono>
                    {c.tonoDeMisa === null ? (
                      <span className="text-sm text-texto-tenue">sin fijar</span>
                    ) : (
                      <button
                        type="button"
                        disabled={pendiente}
                        onClick={() => fijarTono(c.id, null)}
                        className="tactil px-2 text-sm text-texto-tenue underline underline-offset-2 hover:text-texto disabled:opacity-40"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))
      )}

      {asignados.length > 0 && vacios.length > 0 && (
        <p className="mt-4 text-sm text-texto-tenue">
          Sin cantos todavía: {vacios.join(', ')}.
        </p>
      )}

      {[
        { titulo: 'Pedido para esta misa', filas: sugerenciasDeEstaMisa, unidad: ['pedido', 'pedidos'] },
        { titulo: 'Lo que el coro propone', filas: sugerenciasGenerales, unidad: ['voto', 'votos'] },
      ].map(
        ({ titulo, filas, unidad }) =>
          filas.length > 0 && (
            <section key={titulo} className="mt-10">
              <TituloSeccion>{titulo}</TituloSeccion>
              <ul className="mt-2 divide-y divide-borde border-t border-borde">
                {filas.map((f) => {
                  const yaEsta = asignados.some((a) => a.cantoId === f.cantoId)
                  return (
                    <li key={`${f.cantoId}·${f.momentoId}`} className="flex items-center gap-3 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{f.titulo}</span>
                        <span className="block text-sm text-texto-tenue">
                          {f.momentoNombre} · {f.cuantas} {unidad[f.cuantas === 1 ? 0 : 1]}
                        </span>
                      </span>
                      {yaEsta ? (
                        // No se ofrece agregar lo que ya está: la acción
                        // fallaría con «ese canto ya está en la misa», y un
                        // botón que se sabe que va a fallar no se dibuja.
                        <span className="shrink-0 text-sm text-texto-tenue">Ya está</span>
                      ) : (
                        <BotonIcono
                          etiqueta={`Agregar ${f.titulo} en ${f.momentoNombre}`}
                          apariencia="borde"
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
                        >
                          <IconoAgregar tamano={18} />
                        </BotonIcono>
                      )}
                    </li>
                  )
                })}
              </ul>
            </section>
          )
      )}

      <TituloSeccion className="mt-10">Agregar del repertorio</TituloSeccion>

      {disponibles.length === 0 ? (
        <p className="mt-2 text-sm text-texto-tenue">
          Todos los cantos del repertorio ya están en esta misa.
        </p>
      ) : (
        Object.entries(porMomento).map(([momento, cantos]) => {
          const { cantados, nunca } = ordenados(cantos)
          // Plegado por segmento (2026-11-18): con el cancionero entero cargado,
          // la lista abierta medía 25 000 px. El director abre el segmento que
          // está llenando y el resto no estorba.
          return (
            <details key={momento} className="mt-3 border-t border-borde">
              <summary className="tactil flex min-h-11 cursor-pointer items-center gap-2 py-2 text-sm font-semibold text-texto-tenue">
                {momento}
                <span className="font-normal">· {cantos.length}</span>
              </summary>
              {cantados.length > 0 && (
                <ul className="mt-1 divide-y divide-borde border-t border-borde">
                  {cantados.map(filaDisponible)}
                </ul>
              )}
              {nunca.length > 0 && (
                <>
                  <p className="mt-3 text-sm text-texto-tenue">
                    {nunca.length === 1 ? 'Nunca se cantó' : `Nunca se cantaron (${nunca.length})`}
                  </p>
                  <ul className="mt-1 divide-y divide-borde border-t border-borde">
                    {nunca.map(filaDisponible)}
                  </ul>
                </>
              )}
            </details>
          )
        })
      )}
    </div>
  )
}

/** Un canto sin tonalidad original declarada: el tono de la misa en semitonos. */
function semitonos(n: number | null): string {
  if (!n) return n === 0 ? 'original' : '—'
  return n > 0 ? `+${n}` : String(n)
}
