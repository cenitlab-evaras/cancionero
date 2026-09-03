'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { agregarMiembro, cambiarRolLocal } from '../acciones'
import type { PerfilConVinculo } from '@/lib/datos/gobierno'
import type { FichaDeMiembro } from '@/lib/datos/ficha'
import { etiquetaDisponibilidad, etiquetaTesitura } from '@/lib/motores/ficha'

/**
 * Admitir gente al coro y cambiarle el rol.
 *
 * No decide nada: las reglas viven en el motor y en la RLS. Acá solo se llama
 * la acción y se muestra el motivo cuando dice que no.
 */
export default function ListaMiembros({
  enElCoro,
  disponibles,
  directores,
  yoId,
  fichas = [],
}: {
  enElCoro: PerfilConVinculo[]
  disponibles: PerfilConVinculo[]
  directores: number
  yoId: string
  /* H14 · las fichas van EN la fila de cada quien, no en una lista aparte:
     tenerlas en su propia sección listaba dos veces a la misma gente en la
     misma pantalla. Llega vacío para quien no puede verlas (la matriz decide,
     la RLS hace cumplir). */
  fichas?: FichaDeMiembro[]
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

  const nombreDe = (p: PerfilConVinculo) => p.nombre || p.email.split('@')[0]

  const fichaDe = new Map(fichas.map((f) => [f.perfilId, f]))

  /** Lo declarado, y solo lo declarado: un «Sin declarar · Sin declarar · —»
      repetido en cada fila es ruido, y el pie ya dice cuántos faltan. */
  function resumenFicha(perfilId: string): string | null {
    const f = fichaDe.get(perfilId)
    if (!f) return null
    const partes = [
      f.tesitura ? etiquetaTesitura(f.tesitura) : null,
      f.disponibilidad ? etiquetaDisponibilidad(f.disponibilidad) : null,
      f.edad === null ? null : `${f.edad} años`,
    ].filter(Boolean)
    return partes.length > 0 ? partes.join(' · ') : null
  }

  return (
    <div className={pendiente ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      {error && <p className="mt-4 text-sm text-peligro">{error}</p>}

      <h2 className="mt-6 text-[0.8125rem] font-semibold text-texto-tenue uppercase">
        En el coro
      </h2>

      <ul className="mt-2 divide-y divide-borde border-t border-borde">
        {enElCoro.map((p) => (
          <li key={p.id} className="flex min-h-14 items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">
                {nombreDe(p)}
                {p.id === yoId && <span className="text-texto-tenue"> · tú</span>}
              </span>
              <span className="block truncate text-xs text-texto-tenue">{p.email}</span>
              {resumenFicha(p.id) && (
                <span className="mt-0.5 block truncate text-xs text-texto-tenue">
                  {resumenFicha(p.id)}
                  {fichaDe.get(p.id)?.esMenor === true && (
                    /* Se dice, no se deduce: en contexto parroquial tiene
                       consecuencias reales. */
                    <span className="ml-1.5 font-medium text-texto">menor</span>
                  )}
                </span>
              )}
            </span>

            <select
              value={p.rolLocal ?? 'miembro'}
              onChange={(e) =>
                correr(() =>
                  cambiarRolLocal({
                    accesoId: p.accesoId!,
                    rolLocal: e.target.value as 'director' | 'miembro',
                  })
                )
              }
              disabled={pendiente}
              aria-label={`Rol de ${nombreDe(p)} en el coro`}
              className="tactil shrink-0 rounded-lg border border-borde-fuerte bg-superficie px-2 text-sm"
            >
              <option value="miembro">miembro</option>
              <option value="director">director</option>
            </select>
          </li>
        ))}
      </ul>

      {directores <= 1 && (
        // Avisar ANTES, no cuando la acción ya falló: el director tiene que
        // poder anticipar por qué el selector le va a decir que no.
        <p className="mt-2 text-xs text-texto-tenue">
          Hay un solo director. Para cambiarle el rol, primero nombra a otro.
        </p>
      )}

      <h2 className="mt-10 text-[0.8125rem] font-semibold text-texto-tenue uppercase">
        Agregar al coro
      </h2>

      {disponibles.length === 0 ? (
        <p className="mt-2 max-w-prose text-sm text-texto-tenue">
          No hay cuentas aprobadas fuera del coro. Una cuenta nueva primero la tiene que aprobar un
          administrador; recién después aparece acá.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-borde border-t border-borde">
          {disponibles.map((p) => (
            <li key={p.id} className="flex min-h-14 items-center gap-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{nombreDe(p)}</span>
                <span className="block truncate text-xs text-texto-tenue">{p.email}</span>
              </span>
              <button
                onClick={() => correr(() => agregarMiembro({ perfilId: p.id, rolLocal: 'miembro' }))}
                disabled={pendiente}
                className="tactil shrink-0 rounded-lg px-3 text-sm text-acento disabled:opacity-40"
              >
                Agregar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
