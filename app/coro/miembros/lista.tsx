'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { agregarMiembro, cambiarRolLocal } from '../acciones'
import type { PerfilConVinculo } from '@/lib/datos/gobierno'

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
}: {
  enElCoro: PerfilConVinculo[]
  disponibles: PerfilConVinculo[]
  directores: number
  yoId: string
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
            </span>

            <select
              value={p.rolLocal ?? 'musico'}
              onChange={(e) =>
                correr(() =>
                  cambiarRolLocal({
                    accesoId: p.accesoId!,
                    rolLocal: e.target.value as 'director' | 'musico',
                  })
                )
              }
              disabled={pendiente}
              aria-label={`Rol de ${nombreDe(p)} en el coro`}
              className="tactil shrink-0 rounded-lg border border-borde-fuerte bg-superficie px-2 text-sm"
            >
              <option value="musico">músico</option>
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
                onClick={() => correr(() => agregarMiembro({ perfilId: p.id, rolLocal: 'musico' }))}
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
