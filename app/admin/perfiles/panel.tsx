'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { aprobarPerfil, cambiarRolPerfil, crearCoro } from '../../coro/acciones'
import { invitarDirector, reenviarInvitacion, revocarInvitacion } from '../../invitaciones/acciones'
import type { CoroDeAdmin, PerfilConVinculo } from '@/lib/datos/gobierno'
import type { InvitacionPendiente } from '@/lib/datos/invitaciones'
import { fechaEnZona } from '@/lib/motores/fecha'
import TituloSeccion from '@/app/componentes/titulo-seccion'
import { clasesBotonIcono } from '@/app/componentes/boton-icono'

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

/**
 * «2 de diciembre de 2026»: el día del coro, no el del servidor.
 *
 * `fechaEnZona` fija la zona (`America/Santiago`) y devuelve `YYYY-MM-DD`; así
 * el HTML del servidor y el del cliente dicen lo mismo y no hay desajuste de
 * hidratación a las 21:00, cuando en UTC ya es otro día.
 */
function fechaDeVencimiento(iso: string): string {
  const [anio, mes, dia] = fechaEnZona(new Date(iso)).split('-')
  return `${Number(dia)} de ${MESES[Number(mes) - 1]} de ${anio}`
}

export default function PanelAdmin({
  perfiles,
  coros,
  invitaciones,
  yoId,
}: {
  perfiles: PerfilConVinculo[]
  coros: CoroDeAdmin[]
  invitaciones: InvitacionPendiente[]
  yoId: string
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [nombreCoro, setNombreCoro] = useState('')
  const [parroquia, setParroquia] = useState('')
  const [emailDirector, setEmailDirector] = useState('')
  const [coroId, setCoroId] = useState(coros[0]?.id ?? '')
  const [pendiente, empezar] = useTransition()

  function correr(accion: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null)
    empezar(async () => {
      const r = await accion()
      if (!r.ok) setError(r.error ?? 'No pudimos guardar el cambio.')
      router.refresh()
    })
  }

  // Los que esperan van primero: es lo que el admin entra a resolver. Una sola
  // lista, como en el CRM (el dueño, 2026-11-20): la cuenta pendiente se marca
  // con su etiqueta en la misma fila donde después se le cambia el rol.
  const ordenados = [...perfiles].sort(
    (a, b) => Number(a.aprobado) - Number(b.aprobado) || a.email.localeCompare(b.email)
  )
  const nombreDe = (p: PerfilConVinculo) => p.nombre || p.email.split('@')[0]

  // El coro elegido se re-deriva del prop: si se crea el primer coro, el
  // formulario queda apuntando a él sin que el estado guarde un id muerto.
  const coroElegido = coros.some((c) => c.id === coroId) ? coroId : (coros[0]?.id ?? '')
  const nombreDelCoro = new Map(coros.map((c) => [c.id, c.nombre]))

  return (
    <div className={pendiente ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      {error && (
        <p role="status" className="mt-4 text-sm text-peligro">
          {error}
        </p>
      )}

      {/* Invitar directores es trabajo del admin: acá solo se invita ese rol.
          Los miembros los invita el director desde «Miembros». */}
      <TituloSeccion
        className="mt-6"
        detalle={String(invitaciones.length)}
        detalleHablado={
          invitaciones.length === 1
            ? '1 invitación pendiente'
            : `${invitaciones.length} invitaciones pendientes`
        }
      >
        Invitaciones a directores
      </TituloSeccion>

      {coros.length === 0 ? (
        <p className="mt-2 max-w-prose text-sm text-texto-tenue">
          Todavía no hay coros. Crea uno más abajo y después podrás invitar a su director.
        </p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            correr(async () => {
              const r = await invitarDirector({ email: emailDirector, coroId: coroElegido })
              if (r.ok) setEmailDirector('')
              return r
            })
          }}
          className="mt-3 flex flex-col gap-2"
        >
          <p className="max-w-prose text-sm text-texto-tenue">
            Le llega un correo con un enlace para entrar y quedar como director del coro.
          </p>
          <select
            value={coroElegido}
            onChange={(e) => setCoroId(e.target.value)}
            disabled={pendiente}
            aria-label="Coro del director"
            className="tactil cursor-pointer rounded-lg border border-borde-fuerte bg-superficie px-3 text-base text-texto disabled:cursor-default disabled:opacity-40"
          >
            {coros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
          </select>
          <input
            type="email"
            value={emailDirector}
            onChange={(e) => setEmailDirector(e.target.value)}
            placeholder="correo@ejemplo.cl"
            aria-label="Correo del director"
            autoComplete="email"
            className="tactil rounded-lg border border-borde-fuerte bg-superficie px-3 text-base placeholder:text-texto-tenue focus:border-acento"
          />
          <button
            type="submit"
            disabled={pendiente || !coroElegido || emailDirector.trim() === ''}
            className={clasesBotonIcono('lleno', 'px-4 text-sm')}
          >
            Invitar director
          </button>
        </form>
      )}

      {invitaciones.length === 0 ? (
        <p className="mt-3 max-w-prose text-sm text-texto-tenue">
          No hay invitaciones de director pendientes.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-borde border-t border-borde">
          {invitaciones.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{inv.email}</span>
                <span className="block truncate text-sm text-texto-tenue">
                  {nombreDelCoro.get(inv.coroId) ?? 'Coro no disponible'} · vence el{' '}
                  {fechaDeVencimiento(inv.expiraEn)}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => correr(() => reenviarInvitacion(inv.id))}
                  disabled={pendiente}
                  className={clasesBotonIcono('borde', 'px-4 text-sm')}
                >
                  Reenviar
                </button>
                <button
                  type="button"
                  onClick={() => correr(() => revocarInvitacion(inv.id))}
                  disabled={pendiente}
                  className={clasesBotonIcono('borde', 'px-4 text-sm !text-peligro')}
                >
                  Revocar
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <TituloSeccion
        className="mt-10"
        detalle={String(perfiles.length)}
        detalleHablado={perfiles.length === 1 ? '1 cuenta' : `${perfiles.length} cuentas`}
      >
        Cuentas
      </TituloSeccion>

      <ul className="mt-2 divide-y divide-borde border-t border-borde">
        {ordenados.map((p) => (
          <li key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-3">
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate">
                  {nombreDe(p)}
                  {p.id === yoId && <span className="text-sm text-texto-tenue"> (tú)</span>}
                </span>
                {!p.aprobado && (
                  <span className="shrink-0 rounded border border-acento px-1.5 text-sm font-bold text-acento">
                    Pendiente
                  </span>
                )}
              </span>
              <span className="block truncate text-sm text-texto-tenue">{p.email}</span>
              {(p.id === yoId || p.rol === 'externo') && (
                <span className="block text-sm text-texto-tenue capitalize">{p.rol}</span>
              )}
            </span>
            <span className="flex flex-wrap items-center gap-2">
              {p.id !== yoId && p.rol !== 'externo' && (
                <select
                  value={p.rol}
                  onChange={(e) =>
                    correr(() =>
                      cambiarRolPerfil({
                        perfilId: p.id,
                        rol: e.target.value as 'admin' | 'usuario',
                      })
                    )
                  }
                  disabled={pendiente}
                  aria-label={`Rol de ${nombreDe(p)}`}
                  className="tactil shrink-0 cursor-pointer rounded-lg border border-borde-fuerte bg-superficie px-2 text-sm text-texto disabled:cursor-default disabled:opacity-40"
                >
                  <option value="usuario">Usuario</option>
                  <option value="admin">Admin</option>
                </select>
              )}
              {p.id !== yoId &&
                (p.aprobado ? (
                  <button
                    type="button"
                    onClick={() => correr(() => aprobarPerfil({ perfilId: p.id, aprobado: false }))}
                    disabled={pendiente}
                    className={clasesBotonIcono('borde', 'px-4 text-sm')}
                  >
                    Suspender
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => correr(() => aprobarPerfil({ perfilId: p.id, aprobado: true }))}
                    disabled={pendiente}
                    className={clasesBotonIcono('lleno', 'px-4 text-sm')}
                  >
                    Aprobar
                  </button>
                ))}
            </span>
          </li>
        ))}
      </ul>

      <TituloSeccion
        className="mt-10"
        detalle={String(coros.length)}
        detalleHablado={coros.length === 1 ? '1 coro' : `${coros.length} coros`}
      >
        Coros
      </TituloSeccion>

      <ul className="mt-2 divide-y divide-borde border-t border-borde">
        {coros.map((c) => (
          <li key={c.id} className="flex min-h-14 items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate">{c.nombre}</span>
              <span className="block truncate text-sm text-texto-tenue">
                {c.parroquia ?? 'Sin parroquia'}
              </span>
            </span>
            <span className="shrink-0 text-sm text-texto-tenue">
              {c.miembros === 1 ? '1 miembro' : `${c.miembros} miembros`}
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
          className="tactil rounded-lg border border-borde-fuerte bg-superficie px-3 text-base placeholder:text-texto-tenue focus:border-acento"
        />
        <input
          value={parroquia}
          onChange={(e) => setParroquia(e.target.value)}
          placeholder="Parroquia (opcional)"
          aria-label="Parroquia del coro nuevo"
          className="tactil rounded-lg border border-borde-fuerte bg-superficie px-3 text-base placeholder:text-texto-tenue focus:border-acento"
        />
        <button
          type="submit"
          disabled={pendiente || nombreCoro.trim() === ''}
          className={clasesBotonIcono('borde', 'text-sm')}
        >
          Crear coro
        </button>
      </form>
    </div>
  )
}
