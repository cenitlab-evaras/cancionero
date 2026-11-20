import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { obtenerSesion } from '@/lib/sesion'
import { puede, rutaInicial } from '@/lib/permisos'
import { misasDelCoro, obtenerMisa } from '@/lib/datos/misas'
import { repertorioPorMomento } from '@/lib/datos/repertorio'
import { inscritosDeMisa } from '@/lib/datos/inscripciones'
import { fichasDelCoro } from '@/lib/datos/ficha'
import { hoyISO, repertorioConHistorial } from '@/lib/datos/historial'
import { misaDeInicio } from '@/lib/motores/agenda'
import { cuantoFalta, fechaLarga } from '@/lib/motores/fecha'
import { quienFalta, sePuedeInscribir } from '@/lib/motores/inscripcion'
import { describirAntiguedad, ordenarPorUso } from '@/lib/motores/historial'
import { iniciales } from '@/lib/motores/iniciales'
import { avanceDeLaMisa } from '@/lib/motores/tablero'
import Cabecera from '@/app/componentes/cabecera'
import TituloSeccion from '@/app/componentes/titulo-seccion'
import { clasesBotonIcono } from '@/app/componentes/boton-icono'
import { IconoReproducir, IconoSeguir } from '@/app/componentes/iconos'
import Inscripcion from '@/app/misas/[id]/inscripcion'

export const metadata = { title: 'Inicio · Cantoral' }

/**
 * Inicio como tablero (el dueño, 2026-11-19: «que parezca un dashboard»). La
 * portada deja de ser la misa con cuatro listas chicas:
 *
 *   · La próxima misa, en el hero: anillo (solo director), título,
 *     Empezar/Ver y el «¿Vas?» de siempre.
 *   · Las más cantadas: el top 3 del historial, con veces y antigüedad.
 *   · Miembros del coro (solo director): cuántos son, sus iniciales y la
 *     composición de roles y cuerdas.
 *   · En ensayo: cuántos cantos DISTINTOS están en ensayo, cuántos listos y
 *     los primeros títulos.
 *
 * Salieron de acá «Para que quede lista», «Voces que van», «Para repasar», «Se
 * está ensayando», «Después» y «También pendiente»: eso vive en la misa o en
 * Misas. La participación se queda en el hero. «Más cantadas» y «En ensayo»
 * los ven todos; «Miembros» y el «Revisar» son del director.
 *
 * La raíz sigue repartiendo con `rutaInicial()` (PRD §8.3): quien no puede ver
 * un repertorio no ve Inicio, va adonde le corresponde.
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
  const puedeVerFichas = puede(sesion.sujeto, 'ver_ficha_del_coro')
  const puedeRevisar = puede(sesion.sujeto, 'editar_canto')

  const [misas, grupos, conHistorial, fichas] = await Promise.all([
    misasDelCoro(coro.id),
    repertorioPorMomento(coro.id),
    repertorioConHistorial(coro.id),
    puedeVerFichas ? fichasDelCoro(coro.id) : Promise.resolve([]),
  ])

  const resumen = misaDeInicio(misas, hoy)
  const [misa, inscritos] = resumen
    ? await Promise.all([
        obtenerMisa(resumen.id),
        puede(sesion.sujeto, 'ver_inscripciones') ? inscritosDeMisa(resumen.id) : Promise.resolve([]),
      ])
    : [null, []]

  const abierta = resumen ? sePuedeInscribir(resumen.fecha, hoy) : false
  const miInscripcion = inscritos.find((i) => i.perfilId === sesion.usuarioId) ?? null
  const puedeAnotarse = puede(sesion.sujeto, 'inscribirse_a_misa') && abierta

  // El anillo del hero (solo director): qué tan lista está la misa. La lista
  // del coro —las fichas— la lee solo el director (H14); para el resto es vacía
  // y el anillo ni se dibuja.
  const sinResponder = quienFalta(fichas, inscritos, fichas).length
  const tocan = inscritos.filter((i) => i.aporte === 'instrumental').length
  const avance = misa
    ? avanceDeLaMisa({ cantos: misa.cantos, tocan, coro: fichas.length, sinResponder })
    : null

  const empezar =
    misa && misa.cantos.length > 0 ? (
      <Link
        href={`/misas/${misa.id}/${misa.cantos[0].id}`}
        className={clasesBotonIcono('lleno', 'px-5 text-base')}
      >
        <IconoReproducir tamano={16} />
        Empezar la misa
      </Link>
    ) : null

  // Las más cantadas: el top 3 de los que ya sonaron alguna vez (H13).
  const masCantadas = ordenarPorUso(conHistorial)
    .filter((c) => c.historial.veces > 0)
    .slice(0, 3)

  // En ensayo: cantos DISTINTOS —un canto sale una vez por cada momento que
  // tenga— y los listos, para la cuenta y la barra. Se calculan al leer
  // (PRD §8, regla 3).
  const distintos = [...new Map(grupos.flatMap((g) => g.cantos).map((c) => [c.id, c])).values()]
  const enEnsayo = distintos.filter((c) => c.estado === 'en_ensayo')
  const listos = distintos.filter((c) => c.estado === 'listo')
  const totalEstados = enEnsayo.length + listos.length
  const proporcionListos = totalEstados > 0 ? Math.round((100 * listos.length) / totalEstados) : 0

  // Miembros: la composición del coro para la línea «2 directores · 1 miembro».
  const directores = fichas.filter((f) => f.rolLocal === 'director').length
  const miembros = fichas.filter((f) => f.rolLocal === 'miembro').length
  const conCuerda = fichas.filter((f) => f.tesitura !== null).length

  return (
    <>
      <Cabecera sesion={sesion} />

      <main className="mx-auto w-full max-w-2xl px-4 pt-5 pb-10">
        {misa && resumen?.fecha ? (
          <section aria-labelledby="proxima-misa" className="-mx-4 px-4 pt-6 pb-6">
            <div className="flex items-center gap-4">
              {puedeEditarMisa && avance && <Anillo porcentaje={avance.porcentaje} />}
              <div className="min-w-0">
                <p className="text-sm font-bold text-acento">
                  {cuantoFalta(resumen.fecha, hoy)}
                  <span className="font-normal text-texto-tenue"> · {fechaLarga(resumen.fecha)}</span>
                </p>
                <h1 id="proxima-misa" className="mt-1 text-[2.5rem] leading-[1.02] font-bold tracking-[-0.02em]">
                  {misa.nombre}
                </h1>
                {puedeEditarMisa && avance && (
                  <p className="mt-1 text-sm text-texto-tenue">
                    {avance.porcentaje === 100 ? 'Lista' : `Lista en un ${avance.porcentaje} %`}
                  </p>
                )}
              </div>
            </div>

            {/* Empezar o ver la misa: todos. El director, si no hay cantos,
                arma la misa en su lugar. */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {empezar}
              {puedeEditarMisa && !empezar && (
                <Link href={`/misas/${misa.id}/editar`} className={clasesBotonIcono('lleno', 'px-5 text-base')}>
                  Armar esta misa
                </Link>
              )}
              <Link href={`/misas/${misa.id}`} className={clasesBotonIcono('borde', 'px-4 text-base')}>
                Ver la misa
              </Link>
            </div>

            {/* «¿Vas?» acá mismo: el mismo control de un toque de la misa. */}
            {puedeAnotarse && (
              <div className="mt-6 border-t border-borde pt-4">
                <p className="text-[0.9375rem] font-bold">{miInscripcion ? 'Vas a esta misa' : '¿Vas a esta misa?'}</p>
                <Inscripcion misaId={misa.id} mia={miInscripcion} editable />
              </div>
            )}
          </section>
        ) : (
          <section aria-labelledby="sin-misa" className="pt-4 pb-6">
            <h1 id="sin-misa" className="text-[2.5rem] leading-[1.02] font-bold tracking-[-0.02em]">
              No hay ninguna misa agendada
            </h1>
            <p className="mt-2 max-w-prose text-texto-tenue prosa-equilibrada">
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

        {/* El tablero: los tres bloques, debajo del hero. */}
        <Bloque id="mas-cantadas" titulo="Las más cantadas" enlace={{ href: '/historial', texto: 'Historial' }}>
          {masCantadas.length > 0 ? (
            <ol className="mt-1">
              {masCantadas.map((c, i) => (
                <li key={c.id} className="border-b border-borde last:border-b-0">
                  <Link
                    href={`/repertorio/${c.id}`}
                    className="tactil -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-superficie"
                  >
                    <span className="w-4 shrink-0 text-sm text-texto-tenue tabular-nums">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{c.titulo}</span>
                    <span className="shrink-0 text-sm font-bold text-acento tabular-nums">
                      {c.historial.veces}×
                    </span>
                    <span className="shrink-0 text-sm text-texto-tenue">
                      {describirAntiguedad(c.historial.diasDesdeUltima)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-texto-tenue">
              Todavía no hay historial: ninguna misa pasada registrada.
            </p>
          )}
        </Bloque>

        {puedeVerFichas && (
          <Bloque
            id="miembros"
            titulo="Miembros del coro"
            detalle={String(fichas.length)}
            detalleHablado={fichas.length === 1 ? '1 persona' : `${fichas.length} personas`}
            enlace={{ href: '/coro/miembros', texto: 'Ver' }}
          >
            <div className="mt-2 flex items-center gap-2">
              <span className="flex -space-x-1.5" aria-hidden>
                {fichas.slice(0, 4).map((f) => (
                  <span
                    key={f.perfilId}
                    className="inline-flex size-8 items-center justify-center rounded-full border border-borde-fuerte bg-superficie-alta text-sm font-bold text-texto"
                  >
                    {iniciales(f.nombre, f.email)}
                  </span>
                ))}
              </span>
              {fichas.length > 4 && <span className="text-sm text-texto-tenue">+{fichas.length - 4}</span>}
            </div>
            <p className="mt-2 text-sm text-texto-tenue">
              {directores} {directores === 1 ? 'director' : 'directores'} · {miembros}{' '}
              {miembros === 1 ? 'miembro' : 'miembros'} · {conCuerda} con cuerda
            </p>
          </Bloque>
        )}

        <Bloque
          id="en-ensayo"
          titulo="En ensayo"
          enlace={
            puedeRevisar
              ? { href: '/repertorio?vista=todas&estado=en_ensayo', texto: 'Revisar' }
              : { href: '/repertorio?vista=todas&estado=en_ensayo', texto: 'Ver en Canciones' }
          }
        >
          {enEnsayo.length > 0 ? (
            <>
              <p className="mt-2 text-sm text-texto-tenue">
                <span className="font-semibold text-texto tabular-nums">{enEnsayo.length}</span>{' '}
                {enEnsayo.length === 1 ? 'canto' : 'cantos'} ·{' '}
                <span className="font-semibold text-texto tabular-nums">{listos.length}</span>{' '}
                {listos.length === 1 ? 'listo' : 'listos'}
              </p>
              <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-superficie-alta" aria-hidden>
                <span className="bg-acento" style={{ width: `${proporcionListos}%` }} />
                <span className="flex-1 bg-borde-fuerte" />
              </div>
              <ul className="mt-1">
                {enEnsayo.slice(0, 3).map((c) => (
                  <li key={c.id} className="border-b border-borde last:border-b-0">
                    <Link
                      href={`/repertorio/${c.id}`}
                      className="tactil -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-superficie"
                    >
                      <span className="min-w-0 flex-1 truncate">{c.titulo}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="mt-2 text-sm text-texto-tenue">No hay cantos en ensayo.</p>
          )}
        </Bloque>
      </main>
    </>
  )
}

/** El avance de la misa en un anillo: el número adentro, el halo alrededor. */
function Anillo({ porcentaje }: { porcentaje: number }) {
  const radio = 32
  const vuelta = 2 * Math.PI * radio
  return (
    <div className="relative size-[76px] shrink-0" role="img" aria-label={`Misa lista en un ${porcentaje} %`}>
      <svg viewBox="0 0 76 76" className="size-full -rotate-90" aria-hidden>
        <circle cx="38" cy="38" r={radio} fill="none" stroke="var(--color-borde)" strokeWidth="7" />
        <circle
          cx="38"
          cy="38"
          r={radio}
          fill="none"
          stroke="var(--color-acento)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(vuelta * porcentaje) / 100} ${vuelta}`}
        />
      </svg>
      <span className="titulo-libro absolute inset-0 flex items-center justify-center text-lg">{porcentaje}%</span>
    </div>
  )
}

/** Un bloque del tablero: título, enlace opcional a la derecha y su contenido. */
function Bloque({
  id,
  titulo,
  detalle,
  detalleHablado,
  enlace,
  children,
}: {
  id: string
  titulo: string
  detalle?: string
  detalleHablado?: string
  enlace?: { href: string; texto: string }
  children: ReactNode
}) {
  return (
    <section aria-labelledby={id} className="mt-6 border-t border-borde pt-5">
      <div className="flex items-baseline justify-between gap-3">
        <TituloSeccion id={id} detalle={detalle} detalleHablado={detalleHablado}>
          {titulo}
        </TituloSeccion>
        {enlace && (
          <Link
            href={enlace.href}
            className="tactil -my-2 inline-flex shrink-0 items-center gap-0.5 rounded-lg px-1 text-sm text-texto-tenue hover:text-texto"
          >
            {enlace.texto}
            <IconoSeguir tamano={14} className="shrink-0" />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}
