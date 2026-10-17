import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { preferenciasDelPerfil } from '@/lib/datos/repertorio'
import { HERRAMIENTAS } from '@/lib/motores/herramientas'
import Cabecera from '@/app/componentes/cabecera'
import TituloSeccion from '@/app/componentes/titulo-seccion'
import Interruptor from './interruptor'

export const metadata = { title: 'Herramientas · Cantoral' }

/**
 * «Herramientas» (pedido del dueño, 2026-10-17): lo que cada uno prende para
 * sí y sirve sobre todo para ensayar. Cambia lo que VE quien la prende, no lo
 * que ven los demás. Se llega desde «Más».
 */
export default async function HerramientasPage() {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  const { herramientas } = await preferenciasDelPerfil()

  return (
    <>
      <Cabecera sesion={sesion} buscador={false} />
      <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-10">
        <h1 className="titulo-libro text-[1.75rem] leading-tight">Herramientas</h1>
        <p className="mt-1 max-w-prose text-sm text-texto-tenue">
          Se prenden y se apagan para ti; lo que ven los demás no cambia.
        </p>

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
