import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { repertorioConHistorial } from '@/lib/datos/historial'
import { describirAntiguedad, estaOlvidado, ordenarPorUso } from '@/lib/motores/historial'
import { MarcaOlvido } from '@/app/componentes/marcas'
import Cabecera from '@/app/componentes/cabecera'
import TituloSeccion from '@/app/componentes/titulo-seccion'

export const metadata = { title: 'Historial · Cantoral' }

/**
 * El repertorio ordenado por uso (H13).
 *
 * Contesta la segunda pregunta del director, la que la vista de un canto no
 * puede contestar: **qué estamos dejando morir**. Por eso los nunca cantados no
 * están escondidos al final de una lista larga sino en su propio bloque, con
 * título — son el hallazgo de la pantalla, no su resto.
 */
export default async function HistorialPage() {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  // Vacío legítimo, NO falta de acceso (§14).
  if (!sesion.coroActivo) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-10">
          <h1 className="titulo-libro text-[1.75rem] leading-tight">Historial</h1>
          <p className="mt-2 max-w-prose text-base">Todavía no perteneces a ningún coro.</p>
          <p className="mt-2 max-w-prose text-sm text-texto-tenue">
            El historial se arma con las misas de un coro. Cuando pertenezcas a uno, vas a verlo acá.
          </p>
        </main>
      </>
    )
  }

  const cantos = ordenarPorUso(await repertorioConHistorial(sesion.coroActivo.id))
  const cantados = cantos.filter((c) => c.historial.veces > 0)
  const nunca = cantos.filter((c) => c.historial.veces === 0)

  return (
    <>
      <Cabecera sesion={sesion} />

      {/* Destino de primer nivel (se llega desde «Más»): sin flecha de volver. */}
      <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-16">
        <h1 className="titulo-libro text-[1.75rem] leading-tight">Historial</h1>
        <p className="mt-1 max-w-prose text-sm text-texto-tenue">Cuentan las misas que ya pasaron.</p>

        {cantados.length === 0 && nunca.length === 0 && (
          <p className="py-10 text-sm text-texto-tenue">Este coro todavía no tiene repertorio.</p>
        )}

        {cantados.length === 0 && nunca.length > 0 && (
          <p className="mt-8 max-w-prose text-sm text-texto-tenue">
            Todavía no hay ninguna misa pasada registrada, así que ningún canto tiene historial.
            Cuando se arme una misa con fecha y esa fecha pase, va a aparecer acá.
          </p>
        )}

        {cantados.length > 0 && (
          <section className="pt-8">
            <TituloSeccion detalle={String(cantados.length)}>Lo que cantamos</TituloSeccion>

            <ul className="mt-2 border-t border-borde">
              {cantados.map((canto) => (
                <li key={canto.id} className="border-b border-borde/70 last:border-b-0">
                  <Link
                    href={`/repertorio/${canto.id}`}
                    className="tactil -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-superficie"
                  >
                    {/* Sin el número del cancionero (2026-10-17: «debemos ser
                        limpios»). Las veces van a la derecha, con su unidad.

                        NO van en `--color-acorde`: ese cálido está reservado a
                        los acordes y a la tonalidad (§DESIGN, «la regla del
                        acorde»). Usarlo igual entrena al ojo a leer el ámbar
                        como «número importante», y esa lectura se lleva puesta
                        la vista del canto, que es donde el color decide algo. */}
                    <span className="min-w-0 flex-1">
                      {/* El reloj de arena: lleva mucho sin sonar para SU ritmo. */}
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate">{canto.titulo}</span>
                        {estaOlvidado(canto.historial) && <MarcaOlvido className="text-texto-tenue" />}
                      </span>
                      <span className="block truncate text-sm text-texto-tenue">
                        {describirAntiguedad(canto.historial.diasDesdeUltima)}
                        {canto.historial.porMomento.length > 0 && (
                          <> · {canto.historial.porMomento[0].momento}</>
                        )}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm text-texto-tenue">
                      {canto.historial.veces === 1 ? '1 vez' : `${canto.historial.veces} veces`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {nunca.length > 0 && (
          <section className="pt-8">
            <TituloSeccion detalle={String(nunca.length)}>Nunca cantados</TituloSeccion>
            <p className="mt-1 max-w-prose text-sm text-texto-tenue">
              Están en el repertorio pero no han sonado en ninguna misa.
            </p>

            <ul className="mt-2 border-t border-borde">
              {nunca.map((canto) => (
                <li key={canto.id} className="border-b border-borde/70 last:border-b-0">
                  <Link
                    href={`/repertorio/${canto.id}`}
                    className="tactil -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-superficie"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{canto.titulo}</span>
                      {/* Un canto agendado no está olvidado: está por sonar. */}
                      {canto.historial.agendadas.length > 0 && (
                        <span className="block truncate text-sm text-texto-tenue">
                          Agendado en {canto.historial.agendadas[0].misaNombre}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {cantados.length > 0 && (
          <p className="pt-8 text-sm text-texto-tenue">
            {cantados.length} de {cantos.length} cantos se han cantado alguna vez en{' '}
            {sesion.coroActivo.nombre}
          </p>
        )}
      </main>
    </>
  )
}
