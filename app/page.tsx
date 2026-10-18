import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede, rutaInicial } from '@/lib/permisos'
import { misasDelCoro, obtenerMisa } from '@/lib/datos/misas'
import { repertorioPorMomento } from '@/lib/datos/repertorio'
import { inscritosDeMisa } from '@/lib/datos/inscripciones'
import { fichasDelCoro } from '@/lib/datos/ficha'
import { sugerenciasDeMisa, sugerenciasGenerales } from '@/lib/datos/sugerencias'
import { cantosConPartitura } from '@/lib/datos/partitura'
import { hoyISO } from '@/lib/datos/historial'
import { misaDeInicio } from '@/lib/motores/agenda'
import { cuantoFalta, fechaLarga } from '@/lib/motores/fecha'
import { quienFalta, sePuedeInscribir } from '@/lib/motores/inscripcion'
import { rankear } from '@/lib/motores/sugerencia'
import { paraRepasar, pendientesDelDirector, siguientesMisas } from '@/lib/motores/inicio'
import Cabecera from '@/app/componentes/cabecera'
import TituloSeccion from '@/app/componentes/titulo-seccion'
import Anotados from '@/app/componentes/anotados'
import { clasesBotonIcono } from '@/app/componentes/boton-icono'
import { IconoReproducir, IconoSeguir } from '@/app/componentes/iconos'
import Inscripcion from '@/app/misas/[id]/inscripcion'

export const metadata = { title: 'Inicio · Cantoral' }

/**
 * Inicio (rediseño 2026-10-17; tablero desde la noche del mismo día, el dueño:
 * «tiene que ser un dashboard», y después «hazlo»).
 *
 * Contesta lo que cada uno necesita el domingo en la mañana, en este orden:
 *   1. Qué se canta y cómo entrar (la próxima misa, con «Empezar la misa»).
 *   2. Si voy: el mismo control de un toque de la misa, acá, sin entrar.
 *   3. Qué repasar: los cantos de esa misa que tienen partitura.
 *   4. Solo el director: lo que le falta resolver (`pendientesDelDirector`).
 *   5. Lo que viene después, y lo que se está ensayando.
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
  const puedeEditarMisa = puede(sesion.sujeto, 'editar_misa')
  const puedeEnsayar = puede(sesion.sujeto, 'ensayar_canto')

  const [misas, grupos, conPartitura, propuestas] = await Promise.all([
    misasDelCoro(coro.id),
    repertorioPorMomento(coro.id),
    puedeEnsayar ? cantosConPartitura() : Promise.resolve(new Map()),
    // Lo que el coro propuso al repertorio es trabajo del director.
    puedeEditarMisa && puede(sesion.sujeto, 'ver_sugerencias')
      ? sugerenciasGenerales(coro.id)
      : Promise.resolve([]),
  ])

  const resumen = misaDeInicio(misas, hoy)
  const [misa, inscritos, fichas, pedidos] = resumen
    ? await Promise.all([
        obtenerMisa(resumen.id),
        puede(sesion.sujeto, 'ver_inscripciones') ? inscritosDeMisa(resumen.id) : Promise.resolve([]),
        // Quién falta pide la lista del coro, que solo lee el director (H14).
        puedeEditarMisa && puede(sesion.sujeto, 'ver_ficha_del_coro')
          ? fichasDelCoro(coro.id)
          : Promise.resolve([]),
        puedeEditarMisa && puede(sesion.sujeto, 'ver_sugerencias')
          ? sugerenciasDeMisa(resumen.id)
          : Promise.resolve([]),
      ])
    : [null, [], [], []]

  const abierta = resumen ? sePuedeInscribir(resumen.fecha, hoy) : false
  const miInscripcion = inscritos.find((i) => i.perfilId === sesion.usuarioId) ?? null
  const puedeAnotarse = puede(sesion.sujeto, 'inscribirse_a_misa') && abierta

  const repasar = misa ? paraRepasar(misa.cantos, new Set(conPartitura.keys())) : []
  const despues = siguientesMisas(misas, hoy, resumen?.id ?? null)
  const pendientes = puedeEditarMisa
    ? pendientesDelDirector({
        misa: resumen,
        inscritos,
        faltan: quienFalta(fichas, inscritos, fichas).length,
        pedidos: rankear(pedidos).length,
        propuestas: rankear(propuestas).length,
        otras: despues,
        inscripcionAbierta: abierta,
      })
    : []

  // Un canto aparece en cada momento que tenga: se cuenta una vez.
  const vistos = new Set<string>()
  const enEnsayo = grupos
    .flatMap((g) => g.cantos)
    .filter((c) => c.estado === 'en_ensayo' && !vistos.has(c.id) && vistos.add(c.id))

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

            {/* «¿Vas?» acá mismo: decirlo era entrar a la misa y bajar hasta
                «Quién va». Es el mismo control, con la misma acción, que
                revalida el Inicio. */}
            {(puedeAnotarse || resumen.quienes.length > 0) && (
              <div className="mt-7 border-t border-borde pt-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[0.9375rem] font-bold">
                    {puedeAnotarse ? (miInscripcion ? 'Vas a esta misa' : '¿Vas a esta misa?') : 'Quién va'}
                  </p>
                  <span className="flex items-center gap-2 text-sm text-texto-tenue">
                    {resumen.anotados > 0 &&
                      (resumen.anotados === 1 ? 'Va 1' : `Van ${resumen.anotados}`)}
                    <Anotados quienes={resumen.quienes} />
                  </span>
                </div>
                {puedeAnotarse && <Inscripcion misaId={misa.id} mia={miInscripcion} editable />}
              </div>
            )}
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

        {/* Lo del director va arriba de lo que se repasa: si la misa no tiene
            cantos o no hay quién toque, eso se arregla antes del domingo. */}
        {pendientes.length > 0 && (
          <section aria-labelledby="por-resolver" className="mt-8">
            <TituloSeccion id="por-resolver" detalle={String(pendientes.length)}>
              Por resolver
            </TituloSeccion>
            <ul className="mt-1 divide-y divide-borde">
              {pendientes.map((p) => (
                <li key={p.clave}>
                  <Fila href={p.href} texto={p.texto} detalle={p.detalle} marcada />
                </li>
              ))}
            </ul>
          </section>
        )}

        {misa && repasar.length > 0 && (
          <section aria-labelledby="para-repasar" className="mt-8">
            <TituloSeccion id="para-repasar" detalle="con partitura y audio">
              Para repasar antes de la misa
            </TituloSeccion>
            <ul className="mt-1 divide-y divide-borde">
              {repasar.map((c) => (
                <li key={c.id}>
                  <Fila
                    href={`/repertorio/${c.cantoId}/ensayar?misa=${misa.id}&fila=${c.id}`}
                    texto={c.titulo}
                    detalle={c.momentoNombre}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {despues.length > 0 && (
          <section aria-labelledby="despues" className="mt-8">
            <TituloSeccion id="despues">Después</TituloSeccion>
            <ul className="mt-1 divide-y divide-borde">
              {despues.map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/misas/${m.id}`}
                    className="tactil -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-superficie"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{m.nombre}</span>
                      <span className="block text-sm text-texto-tenue">
                        {m.fecha ? fechaLarga(m.fecha) : 'Sin fecha'} ·{' '}
                        {m.cantidadCantos === 0
                          ? 'sin cantos'
                          : m.cantidadCantos === 1
                            ? '1 canto'
                            : `${m.cantidadCantos} cantos`}
                      </span>
                    </span>
                    <Anotados quienes={m.quienes} />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {enEnsayo.length > 0 && (
          <section aria-labelledby="en-ensayo" className="mt-8">
            <TituloSeccion id="en-ensayo">Se está ensayando</TituloSeccion>
            <ul className="mt-1 divide-y divide-borde">
              {enEnsayo.map((c) => (
                <li key={c.id}>
                  <Fila href={`/repertorio/${c.id}`} texto={c.titulo} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  )
}

/**
 * Una fila del tablero: lleva a donde se resuelve. `marcada` le pone el punto
 * del halo a lo que el director tiene pendiente, para que no se lea como una
 * lista más.
 */
function Fila({
  href,
  texto,
  detalle,
  marcada = false,
}: {
  href: string
  texto: string
  detalle?: string
  marcada?: boolean
}) {
  return (
    <Link
      href={href}
      className="tactil -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-superficie"
    >
      {marcada && <span aria-hidden className="size-2 shrink-0 rounded-full bg-acento" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{texto}</span>
        {detalle && <span className="block truncate text-sm text-texto-tenue">{detalle}</span>}
      </span>
      <IconoSeguir tamano={18} className="shrink-0 text-texto-tenue" />
    </Link>
  )
}
