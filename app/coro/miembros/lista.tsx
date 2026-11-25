'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { quitarMiembro } from '../acciones'
import { reenviarInvitacion, revocarInvitacion } from '@/app/invitaciones/acciones'
import type { PerfilConVinculo } from '@/lib/datos/gobierno'
import type { InvitacionPendiente } from '@/lib/datos/invitaciones'
import type { FichaDeMiembro } from '@/lib/datos/ficha'
import { etiquetaDisponibilidad, etiquetaTesitura } from '@/lib/motores/ficha'
import { fechaEnZona } from '@/lib/motores/fecha'
import TituloSeccion from '@/app/componentes/titulo-seccion'
import { clasesBotonIcono } from '@/app/componentes/boton-icono'
import Invitar from './invitar'

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

/**
 * Invitar miembros, ver quién está en el coro y quitar a un miembro.
 *
 * No decide nada: las reglas viven en la RLS y en las actions. Acá solo se
 * llama la acción y se muestra el motivo cuando dice que no. Los roles locales
 * ya no se cambian desde esta pantalla: eso es del administrador.
 */
export default function ListaMiembros({
  enElCoro,
  yoId,
  fichas = [],
  invitaciones,
}: {
  enElCoro: PerfilConVinculo[]
  yoId: string
  /* H14 · las fichas van EN la fila de cada quien, no en una lista aparte:
     tenerlas en su propia sección listaba dos veces a la misma gente en la
     misma pantalla. Llega vacío para quien no puede verlas (la matriz decide,
     la RLS hace cumplir). */
  fichas?: FichaDeMiembro[]
  invitaciones: InvitacionPendiente[]
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
      repetido en cada fila es ruido, y el pie ya dice cuántos faltan.
      Cada dato va en su propio trozo y no cosido con puntos medios: son tres
      cosas distintas (rediseño 2026-10-17). */
  function resumenFicha(perfilId: string): string[] {
    const f = fichaDe.get(perfilId)
    if (!f) return []
    return [
      f.tesitura ? etiquetaTesitura(f.tesitura) : null,
      f.disponibilidad ? etiquetaDisponibilidad(f.disponibilidad) : null,
      f.edad === null ? null : `${f.edad} años`,
    ].filter((x): x is string => !!x)
  }

  return (
    <div className={pendiente ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
      <Invitar />

      {error && (
        <p role="status" className="mt-4 text-sm text-peligro">
          {error}
        </p>
      )}

      <TituloSeccion
        className="mt-10"
        detalle={String(enElCoro.length)}
        detalleHablado={enElCoro.length === 1 ? '1 persona' : `${enElCoro.length} personas`}
      >
        En el coro
      </TituloSeccion>

      <ul className="mt-2 divide-y divide-borde border-t border-borde">
        {enElCoro.map((p) => (
          <li key={p.id} className="flex min-h-14 items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate">
                {nombreDe(p)}
                {p.id === yoId && <span className="text-sm text-texto-tenue"> (tú)</span>}
              </span>
              <span className="block truncate text-sm text-texto-tenue">{p.email}</span>
              {resumenFicha(p.id).length > 0 && (
                <span className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-texto-tenue">
                  {resumenFicha(p.id).map((dato) => (
                    <span key={dato}>{dato}</span>
                  ))}
                  {fichaDe.get(p.id)?.esMenor === true && (
                    /* Se dice, no se deduce: en contexto parroquial tiene
                       consecuencias reales. */
                    <span className="font-medium text-texto">Menor de edad</span>
                  )}
                </span>
              )}
            </span>

            {/* Un director quita MIEMBROS; las filas de director solo las quita
                el admin. A nadie se le ofrece quitarse a sí mismo. */}
            {p.rolLocal === 'miembro' && p.id !== yoId && p.accesoId && (
              <button
                type="button"
                onClick={() => correr(() => quitarMiembro({ accesoId: p.accesoId! }))}
                disabled={pendiente}
                aria-label={`Quitar a ${nombreDe(p)} del coro`}
                className={clasesBotonIcono('borde', 'px-4 text-sm !text-peligro')}
              >
                Quitar
              </button>
            )}
          </li>
        ))}
      </ul>

      <TituloSeccion
        className="mt-10"
        detalle={String(invitaciones.length)}
        detalleHablado={
          invitaciones.length === 1
            ? '1 invitación pendiente'
            : `${invitaciones.length} invitaciones pendientes`
        }
      >
        Invitaciones pendientes
      </TituloSeccion>

      {invitaciones.length === 0 ? (
        <p className="mt-2 max-w-prose text-sm text-texto-tenue">
          No hay invitaciones pendientes.
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-borde border-t border-borde">
          {invitaciones.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-3"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{inv.email}</span>
                <span className="block truncate text-sm text-texto-tenue">
                  vence el {fechaDeVencimiento(inv.expiraEn)}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => correr(() => reenviarInvitacion(inv.id))}
                  disabled={pendiente}
                  aria-label={`Reenviar la invitación a ${inv.email}`}
                  className={clasesBotonIcono('borde', 'px-4 text-sm')}
                >
                  Reenviar
                </button>
                <button
                  type="button"
                  onClick={() => correr(() => revocarInvitacion(inv.id))}
                  disabled={pendiente}
                  aria-label={`Revocar la invitación a ${inv.email}`}
                  className={clasesBotonIcono('borde', 'px-4 text-sm !text-peligro')}
                >
                  Revocar
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
