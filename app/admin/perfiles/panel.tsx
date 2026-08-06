'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { aprobarPerfil, crearCoro } from '../../coro/acciones'
import type { CoroDeAdmin, PerfilConVinculo } from '@/lib/datos/gobierno'

export default function PanelAdmin({
  perfiles,
  coros,
  yoId,
}: {
  perfiles: PerfilConVinculo[]
  coros: CoroDeAdmin[]
  yoId: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [nombreCoro, setNombreCoro] = useState('')
  const [parroquia, setParroquia] = useState('')
  const [pendiente, empezar] = useTransition()

  function correr(accion: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    empezar(async () => {
      const r = await accion()
      if (!r.ok) setError(r.error ?? 'No pudimos guardar el cambio.')
      router.refresh()
    })
  }

  // Los que esperan van primero: es lo que el admin entra a resolver.
  const esperando = perfiles.filter((p) => !p.aprobado)
  const habilitados = perfiles.filter((p) => p.aprobado)
  const nombreDe = (p: PerfilConVinculo) => p.nombre || p.email.split('@')[0]

  return (
    <div className={pendiente ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      {error && <p className="mt-4 text-sm text-peligro">{error}</p>}

      <h2 className="mt-6 text-[0.8125rem] font-semibold text-texto-tenue uppercase">
        Esperando aprobación
      </h2>

      {esperando.length === 0 ? (
        <p className="mt-2 text-sm text-texto-tenue">
          Ninguna cuenta está esperando. Cuando alguien se registre, aparece acá.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-borde border-t border-borde">
          {esperando.map((p) => (
            <li key={p.id} className="flex min-h-14 items-center gap-3 py-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{nombreDe(p)}</span>
                <span className="block truncate text-xs text-texto-tenue">{p.email}</span>
              </span>
              <button
                onClick={() => correr(() => aprobarPerfil({ perfilId: p.id, aprobado: true }))}
                disabled={pendiente}
                className="tactil shrink-0 rounded-lg bg-acento px-3 text-sm font-medium text-white disabled:opacity-40"
              >
                Aprobar
              </button>
            </li>
          ))}
        </ul>
      )}

      <h2 className="mt-10 text-[0.8125rem] font-semibold text-texto-tenue uppercase">
        Cuentas habilitadas
      </h2>

      <ul className="mt-2 divide-y divide-borde border-t border-borde">
        {habilitados.map((p) => (
          <li key={p.id} className="flex min-h-14 items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">
                {nombreDe(p)}
                {p.id === yoId && <span className="text-texto-tenue"> · tú</span>}
              </span>
              <span className="block truncate text-xs text-texto-tenue">
                {p.email} · {p.rol}
              </span>
            </span>
            {p.id !== yoId && (
              <button
                onClick={() => correr(() => aprobarPerfil({ perfilId: p.id, aprobado: false }))}
                disabled={pendiente}
                className="tactil shrink-0 rounded-lg px-3 text-sm text-texto-tenue disabled:opacity-40"
              >
                Suspender
              </button>
            )}
          </li>
        ))}
      </ul>

      <h2 className="mt-10 text-[0.8125rem] font-semibold text-texto-tenue uppercase">Coros</h2>

      <ul className="mt-2 divide-y divide-borde border-t border-borde">
        {coros.map((c) => (
          <li key={c.id} className="flex min-h-14 items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{c.nombre}</span>
              <span className="block truncate text-xs text-texto-tenue">
                {c.parroquia ?? 'sin parroquia'} ·{' '}
                {c.miembros === 1 ? '1 miembro' : `${c.miembros} miembros`}
              </span>
            </span>
          </li>
        ))}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          correr(async () => {
            const r = await crearCoro({ nombre: nombreCoro, parroquia })
            if (r.ok) {
              setNombreCoro('')
              setParroquia('')
            }
            return r
          })
        }}
        className="mt-4 flex flex-col gap-2"
      >
        <input
          value={nombreCoro}
          onChange={(e) => setNombreCoro(e.target.value)}
          placeholder="Nombre del coro nuevo"
          aria-label="Nombre del coro nuevo"
          className="h-11 rounded-lg border border-borde-fuerte bg-superficie px-3 text-sm placeholder:text-texto-tenue focus:border-acento"
        />
        <input
          value={parroquia}
          onChange={(e) => setParroquia(e.target.value)}
          placeholder="Parroquia (opcional)"
          aria-label="Parroquia del coro nuevo"
          className="h-11 rounded-lg border border-borde-fuerte bg-superficie px-3 text-sm placeholder:text-texto-tenue focus:border-acento"
        />
        <button
          type="submit"
          disabled={pendiente || nombreCoro.trim() === ''}
          className="tactil rounded-lg border border-borde-fuerte text-sm disabled:opacity-40"
        >
          Crear coro
        </button>
      </form>
    </div>
  )
}
