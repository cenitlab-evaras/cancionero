import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { sugerenciasGenerales } from '@/lib/datos/sugerencias'
import { rankear } from '@/lib/motores/sugerencia'
import Cabecera from '@/app/componentes/cabecera'

export const metadata = { title: 'Sugerencias · Cantoral' }

/**
 * Qué quiere cantar el coro — H17, §19.2-B9.
 *
 * ACÁ VIVEN SOLO LAS PROPUESTAS GENERALES. Las que se hicieron para una misa
 * concreta se ven en esa misa: son la respuesta a otra pregunta —«qué pedimos
 * para el domingo»— y mezclarlas daría un número que no contesta ninguna de las
 * dos (§17, la decisión del hito).
 *
 * El orden es un recuento, no un modelo (§10): más personas primero, y a igual
 * cantidad la propuesta más reciente. Se puede explicar en una frase, que es lo
 * que lo hace usable para decidir.
 */
export default async function SugerenciasPage() {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  // Las dos capas de §15-4: no se ofrece, y por URL tampoco entra.
  if (!puede(sesion.sujeto, 'ver_sugerencias') || !sesion.coroActivo) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-10">
          <h1 className="titulo-libro text-[1.75rem] leading-tight text-peligro">
            No tienes acceso a las sugerencias de este coro
          </h1>
          <p className="mt-2 max-w-prose text-sm text-texto-tenue">
            Las propuestas son del coro al que perteneces, y todavía no estás en uno.
          </p>
          <Link
            href="/repertorio"
            className="mt-6 inline-block text-sm text-acento underline underline-offset-2"
          >
            Volver al repertorio
          </Link>
        </main>
      </>
    )
  }

  const ranking = rankear(await sugerenciasGenerales(sesion.coroActivo.id))

  return (
    <>
      <Cabecera sesion={sesion} />
      {/* Destino de primer nivel (se llega desde «Más»): sin flecha de volver. */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-10">
        <h1 className="titulo-libro text-[1.75rem] leading-tight">Sugerencias</h1>

        {ranking.length === 0 ? (
          // Un estado vacío explica POR QUÉ está vacío (§14).
          <p className="mt-4 max-w-prose text-sm text-texto-tenue">
            Todavía nadie propuso nada. Al abrir un canto vas a poder proponerlo para un momento, y
            acá se va a ver cuáles junta más gente.
          </p>
        ) : (
          <>
            <p className="mt-1 max-w-prose text-sm text-texto-tenue">
              Lo que el coro propone, del más pedido al menos. Lo que se pidió para una misa
              concreta se ve en esa misa.
            </p>

            {/* El recuento va a la derecha, en tenue y con su unidad: no es un
                acorde, así que no lleva el ámbar (§DESIGN, «la regla del
                acorde»). Quiénes lo proponen, en su propia línea. */}
            <ul className="mt-4 divide-y divide-borde border-t border-borde">
              {ranking.map((f) => (
                <li key={`${f.cantoId}·${f.momentoId}`}>
                  <Link
                    href={`/repertorio/${f.cantoId}`}
                    className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-superficie"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base">{f.titulo}</span>
                      <span className="block text-sm text-texto-tenue">{f.momentoNombre}</span>
                      <span className="block text-sm text-texto-tenue">
                        Lo {f.quienes.length === 1 ? 'propone' : 'proponen'} {f.quienes.join(', ')}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm text-texto-tenue">
                      {f.cuantas} {f.cuantas === 1 ? 'voto' : 'votos'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
    </>
  )
}
