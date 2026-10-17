import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { preferenciasDelPerfil } from '@/lib/datos/repertorio'
import { HERRAMIENTAS } from '@/lib/motores/herramientas'
import Cabecera from '@/app/componentes/cabecera'
import TituloSeccion from '@/app/componentes/titulo-seccion'
import { IconoAgregar, IconoSeguir } from '@/app/componentes/iconos'
import Interruptor from './interruptor'

export const metadata = { title: 'Herramientas · Cantoral' }

/**
 * «Herramientas» (pedido del dueño, 2026-10-17): lo que cada uno prende para
 * sí y sirve sobre todo para ensayar. Cambia lo que VE quien la prende, no lo
 * que ven los demás. Se llega desde «Más».
 *
 * Desde el 2026-10-17 también junta las acciones del director que no son de
 * una pantalla en particular: «Cargar un canto nuevo» vivía al lado del
 * buscador del repertorio, y el dueño la quiso acá.
 */
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
        <h1 className="titulo-libro text-[1.75rem] leading-tight">Herramientas</h1>
        <p className="mt-1 max-w-prose text-sm text-texto-tenue">
          Se prenden y se apagan para ti; lo que ven los demás no cambia.
        </p>

        {cargaCantos && (
          <section className="pt-6">
            <TituloSeccion>Del director</TituloSeccion>
            <ul className="mt-1">
              <li>
                <Link
                  href="/repertorio/nuevo"
                  className="tactil flex items-center gap-4 rounded-lg px-3 py-2.5 transition-colors hover:bg-superficie"
                >
                  <IconoAgregar className="text-texto-tenue" />
                  <span className="min-w-0 flex-1">
                    <span className="block">Cargar un canto nuevo</span>
                    <span className="block truncate text-sm text-texto-tenue">
                      Título, letra y acordes
                    </span>
                  </span>
                  <IconoSeguir tamano={18} className="shrink-0 text-texto-tenue" />
                </Link>
              </li>
            </ul>
          </section>
        )}

        <section className="pt-6">
          <TituloSeccion>Para ensayar y tocar</TituloSeccion>
          <ul className="mt-1 divide-y divide-borde">
            {HERRAMIENTAS.map((h) => (
              <Interruptor
                key={h.id}
                id={h.id}
                nombre={h.nombre}
                detalle={h.detalle}
                prendida={herramientas.includes(h.id)}
              />
            ))}
          </ul>
        </section>
      </main>
    </>
  )
}
