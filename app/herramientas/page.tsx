import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { preferenciasDelPerfil } from '@/lib/datos/repertorio'
import { HERRAMIENTAS, type Herramienta } from '@/lib/motores/herramientas'
import Cabecera from '@/app/componentes/cabecera'
import TituloSeccion from '@/app/componentes/titulo-seccion'
import {
  IconoAcordesLatinos,
  IconoAgregar,
  IconoDarTono,
  IconoQuienCanta,
  IconoResaltarCuerda,
  IconoSeguir,
} from '@/app/componentes/iconos'
import Celda from './celda'

export const metadata = { title: 'Herramientas · Cantoral' }

/**
 * «Herramientas» (pedido del dueño, 2026-10-17): lo que cada uno prende para
 * sí y sirve sobre todo para ensayar. Cambia lo que VE quien la prende, no lo
 * que ven los demás. Se llega desde «Más».
 *
 * Desde el 2026-11-25 las cuatro se agrupan en dos cajas por uso —«Para leer»
 * y «Para tocar»— en vez de una lista hacia abajo (maqueta C, elegida por el
 * dueño). Cada caja es una grilla de dos por dos celdas; el detalle de cada
 * herramienta queda como descripción accesible, no como texto visible.
 *
 * Desde el 2026-10-17 también junta las acciones del director que no son de
 * una pantalla en particular: «Cargar un canto nuevo» vivía al lado del
 * buscador del repertorio, y el dueño la quiso acá.
 */

const GRUPOS: readonly { titulo: string; ids: readonly Herramienta[] }[] = [
  { titulo: 'Para leer', ids: ['quien_canta', 'mi_cuerda'] },
  { titulo: 'Para tocar', ids: ['dar_tono', 'notacion_latina'] },
]

const ICONOS: Record<Herramienta, ReactNode> = {
  quien_canta: <IconoQuienCanta tamano={20} />,
  mi_cuerda: <IconoResaltarCuerda tamano={20} />,
  dar_tono: <IconoDarTono tamano={20} />,
  notacion_latina: <IconoAcordesLatinos tamano={20} />,
}

const POR_ID = new Map(HERRAMIENTAS.map((h) => [h.id, h]))

export default async function HerramientasPage() {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  const { herramientas } = await preferenciasDelPerfil()
  const cargaCantos = !!sesion.coroActivo && puede(sesion.sujeto, 'editar_canto')

  return (
    <>
      <Cabecera sesion={sesion} buscador={false} />
      <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-10">
        <h1 className="titulo-pantalla leading-tight">Herramientas</h1>
        <p className="mt-1 max-w-prose text-sm text-texto-tenue">
          Se prenden y se apagan para ti; lo que ven los demás no cambia.
        </p>

        {cargaCantos && (
          <section className="pt-6">
            <TituloSeccion>Del director</TituloSeccion>
            <Link
              href="/repertorio/nuevo"
              className="tactil mt-2 flex items-center gap-3 rounded-xl border border-borde bg-superficie px-4 py-3 transition-colors hover:bg-superficie-alta"
            >
              <IconoAgregar className="shrink-0 text-texto-tenue" />
              <span className="min-w-0 flex-1">
                <span className="block text-[0.9375rem] font-semibold">
                  Cargar un canto nuevo
                </span>
                <span className="block truncate text-sm text-texto-tenue">
                  Título, letra y acordes
                </span>
              </span>
              <IconoSeguir tamano={18} className="shrink-0 text-texto-tenue" />
            </Link>
          </section>
        )}

        {GRUPOS.map((grupo) => (
          <section key={grupo.titulo} className="pt-6">
            <TituloSeccion>{grupo.titulo}</TituloSeccion>
            <div className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-borde bg-borde">
              {grupo.ids.map((id) => {
                const herramienta = POR_ID.get(id)
                if (!herramienta) return null
                return (
                  <Celda
                    key={id}
                    id={id}
                    nombre={herramienta.nombre}
                    detalle={herramienta.detalle}
                    icono={ICONOS[id]}
                    prendida={herramientas.includes(id)}
                  />
                )
              })}
            </div>
          </section>
        ))}
      </main>
    </>
  )
}
