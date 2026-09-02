import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { repertorioConHistorial } from '@/lib/datos/historial'
import { describirAntiguedad, ordenarPorUso } from '@/lib/motores/historial'
import Cabecera from '@/app/componentes/cabecera'

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
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <h1 className="text-lg font-semibold">Todavía no perteneces a ningún coro</h1>
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

      <main className="mx-auto w-full max-w-2xl px-4 pb-16">
        <div className="flex items-baseline gap-3 pt-4">
          <Link
            href="/repertorio"
            className="-ml-1 shrink-0 rounded px-1 text-sm text-texto-tenue transition-colors hover:text-texto"
            aria-label="Volver al repertorio"
          >
            ←
          </Link>
          <h1 className="text-[1.375rem] leading-tight font-semibold">Historial</h1>
        </div>

        <p className="mt-1.5 max-w-prose pl-7 text-xs text-texto-tenue">
          Se cuenta lo que ya se cantó: una misa con fecha futura o una lista sin fecha no suman.
        </p>

        {cantados.length === 0 && nunca.length === 0 && (
          <p className="py-10 text-sm text-texto-tenue">Este coro todavía no tiene repertorio.</p>
        )}

        {cantados.length === 0 && nunca.length > 0 && (
          <p className="mt-8 max-w-prose text-sm text-texto-tenue">
            Todavía no hay ninguna misa pasada registrada, así que ningún canto tiene historial.
            Cuando se arme una celebración con fecha y esa fecha pase, va a aparecer acá.
          </p>
        )}

        {cantados.length > 0 && (
          <section className="pt-7">
            <h2 className="flex items-center gap-3 text-[0.8125rem] font-semibold tracking-[0.14em] text-texto-tenue uppercase">
              Lo que cantamos
              <span className="h-px flex-1 bg-borde" aria-hidden />
            </h2>

            <ul className="mt-1">
              {cantados.map((canto) => (
                <li key={canto.id} className="border-b border-borde/70 last:border-b-0">
                  <Link
                    href={`/repertorio/${canto.id}`}
                    className="tactil -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-superficie"
                  >
                    {/* El número a la izquierda, como el del cancionero en el
                        listado: la columna donde el ojo ya sabe buscar.

                        NO va en `--color-acorde`: ese cálido está reservado a
                        los acordes y a la tonalidad (§DESIGN, «la regla del
                        acorde»). Acá no hay ningún acorde en pantalla, pero
                        usarlo igual entrena al ojo a leer el naranja como
                        «número importante», y esa lectura se lleva puesta la
                        vista del canto, que es donde el color decide algo.
                        La jerarquía la dan la mono, el ancho fijo y la
                        alineación a la derecha. */}
                    <span className="w-7 shrink-0 text-right font-cifrado text-sm text-texto">
                      {canto.historial.veces}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{canto.titulo}</span>
                      <span className="block truncate text-xs text-texto-tenue">
                        {describirAntiguedad(canto.historial.diasDesdeUltima)}
                        {canto.historial.porMomento.length > 0 && (
                          <> · {canto.historial.porMomento[0].momento}</>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {nunca.length > 0 && (
          <section className="pt-7">
            <h2 className="flex items-center gap-3 text-[0.8125rem] font-semibold tracking-[0.14em] text-texto-tenue uppercase">
              Nunca cantados
              <span className="h-px flex-1 bg-borde" aria-hidden />
            </h2>
            <p className="mt-1.5 max-w-prose text-xs text-texto-tenue">
              Están en el repertorio pero no han sonado en ninguna misa.
            </p>

            <ul className="mt-2">
              {nunca.map((canto) => (
                <li key={canto.id} className="border-b border-borde/70 last:border-b-0">
                  <Link
                    href={`/repertorio/${canto.id}`}
                    className="tactil -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-superficie"
                  >
                    <span className="w-7 shrink-0 text-right font-cifrado text-sm text-texto-tenue">
                      —
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{canto.titulo}</span>
                      {/* Un canto agendado no está olvidado: está por sonar. */}
                      {canto.historial.agendadas.length > 0 && (
                        <span className="block truncate text-xs text-texto-tenue">
                          agendado en {canto.historial.agendadas[0].celebracionNombre}
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
          <p className="pt-8 text-xs text-texto-tenue">
            {cantados.length} de {cantos.length} cantos se han cantado alguna vez en{' '}
            {sesion.coroActivo.nombre}
          </p>
        )}
      </main>
    </>
  )
}
