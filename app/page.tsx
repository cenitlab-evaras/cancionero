import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede, rutaInicial } from '@/lib/permisos'
import { misasDelCoro, obtenerMisa } from '@/lib/datos/misas'
import { repertorioPorMomento } from '@/lib/datos/repertorio'
import { inscritosDeMisa } from '@/lib/datos/inscripciones'
import { hoyISO } from '@/lib/datos/historial'
import { misaDeInicio } from '@/lib/motores/agenda'
import { cuantoFalta, fechaLarga } from '@/lib/motores/fecha'
import Cabecera from '@/app/componentes/cabecera'
import TituloSeccion from '@/app/componentes/titulo-seccion'
import { clasesBotonIcono } from '@/app/componentes/boton-icono'
import { IconoReproducir } from '@/app/componentes/iconos'

export const metadata = { title: 'Inicio · Cantoral' }

/**
 * Inicio (rediseño 2026-10-17): la próxima misa, y lo que se está ensayando.
 *
 * El trabajo que PRODUCT.md pone primero es «encontrar el canto del momento
 * litúrgico que viene». Antes se abría el repertorio —86 cantos— y la misa del
 * domingo estaba a dos pantallas. Ahora se abre la app y está ahí, con un botón
 * que entra directo al primer canto.
 *
 * La raíz sigue repartiendo con `rutaInicial()` (PRD §8.3): quien no puede ver
 * un repertorio no ve Inicio, va adonde le corresponde.
 *
 * El halo detrás de la misa es el ÚNICO lugar de la app donde se usa: es la
 * firma del coro, sacada de su logo, y repetida perdería su sentido.
 */
export default async function Inicio() {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')

  const destino = rutaInicial(sesion.sujeto)
  if (destino !== '/repertorio') redirect(destino)
  if (!sesion.coroActivo) redirect('/coros')

  const coro = sesion.coroActivo
  const hoy = hoyISO()

  const [misas, grupos] = await Promise.all([
    misasDelCoro(coro.id),
    repertorioPorMomento(coro.id),
  ])

  const resumen = misaDeInicio(misas, hoy)
  const [misa, inscritos] = resumen
    ? await Promise.all([
        obtenerMisa(resumen.id),
        puede(sesion.sujeto, 'ver_inscripciones') ? inscritosDeMisa(resumen.id) : Promise.resolve([]),
      ])
    : [null, []]

  // Un canto aparece en cada momento que tenga: se cuenta una vez.
  const vistos = new Set<string>()
  const enEnsayo = grupos
    .flatMap((g) => g.cantos)
    .filter((c) => c.estado === 'en_ensayo' && !vistos.has(c.id) && vistos.add(c.id))

  const puedeEditarMisa = puede(sesion.sujeto, 'editar_misa')

  return (
    <>
      <Cabecera sesion={sesion} />

      <main className="mx-auto w-full max-w-2xl px-4 pt-5 pb-10">
        {misa && resumen?.fecha ? (
          <section aria-labelledby="proxima-misa" className="halo -mx-4 px-4 pt-6 pb-7">
            <p className="text-sm font-bold text-acento">
              {cuantoFalta(resumen.fecha, hoy)}
              <span className="font-normal text-texto-tenue"> · {fechaLarga(resumen.fecha)}</span>
            </p>
            <h1 id="proxima-misa" className="titulo-libro mt-1 text-[2rem] leading-[1.1]">
              {misa.nombre}
            </h1>

            {misa.cantos.length > 0 ? (
              <ol className="mt-5 space-y-2">
                {misa.cantos.map((c) => (
                  <li key={c.id} className="flex items-baseline gap-3">
                    <span className="w-24 shrink-0 text-sm text-texto-tenue">{c.momentoNombre}</span>
                    {/* Sin el tono (el dueño, 2026-10-17: «aquí no se necesita»):
                        se ve dentro de la misa y en «Armar la misa». */}
                    <span className="min-w-0 flex-1 truncate">{c.titulo}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-4 max-w-prose text-texto-tenue">
                Todavía no tiene cantos asignados.
              </p>
            )}

            {inscritos.length > 0 && (
              <p className="mt-4 text-sm text-texto-tenue">
                {inscritos.length === 1 ? 'Va 1 persona del coro' : `Van ${inscritos.length} personas del coro`}
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-2">
              {misa.cantos.length > 0 ? (
                <Link
                  href={`/misas/${misa.id}/${misa.cantos[0].id}`}
                  className={clasesBotonIcono('lleno', 'px-5 text-base')}
                >
                  <IconoReproducir tamano={16} />
                  Empezar la misa
                </Link>
              ) : (
                puedeEditarMisa && (
                  <Link href={`/misas/${misa.id}/editar`} className={clasesBotonIcono('lleno', 'px-5 text-base')}>
                    Armar esta misa
                  </Link>
                )
              )}
              <Link href={`/misas/${misa.id}`} className={clasesBotonIcono('borde', 'px-4 text-base')}>
                Ver la misa
              </Link>
            </div>
          </section>
        ) : (
          <section aria-labelledby="sin-misa" className="pt-4 pb-6">
            <h1 id="sin-misa" className="titulo-libro text-[1.75rem] leading-tight">
              No hay ninguna misa agendada
            </h1>
            <p className="mt-2 max-w-prose text-texto-tenue">
              {puedeEditarMisa
                ? 'Agenda la próxima y aparece acá, lista para empezar.'
                : 'Cuando el director agende la próxima, aparece acá, lista para empezar.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {puedeEditarMisa && (
                <Link href="/misas/nueva" className={clasesBotonIcono('lleno', 'px-5 text-base')}>
                  Agendar una misa
                </Link>
              )}
              <Link href="/misas" className={clasesBotonIcono('borde', 'px-4 text-base')}>
                Ver las misas
              </Link>
            </div>
          </section>
        )}

        {enEnsayo.length > 0 && (
          <section aria-labelledby="en-ensayo" className="mt-8">
            <TituloSeccion id="en-ensayo">Se está ensayando</TituloSeccion>
            <ul className="mt-2">
              {enEnsayo.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/repertorio/${c.id}`}
                    className="tactil -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-superficie"
                  >
                    <span className="min-w-0 flex-1 truncate">{c.titulo}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  )
}
