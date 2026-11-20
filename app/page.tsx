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
import { ordenarPorUso } from '@/lib/motores/historial'
import { avanceDeLaMisa } from '@/lib/motores/tablero'
import Cabecera from '@/app/componentes/cabecera'
import { clasesBotonIcono } from '@/app/componentes/boton-icono'
import { IconoSeguir } from '@/app/componentes/iconos'
import Inscripcion from '@/app/misas/[id]/inscripcion'

export const metadata = { title: 'Inicio · Cantoral' }

/**
 * Inicio como tablero (el dueño, 2026-11-19: «que parezca un dashboard»; y el
 * 2026-11-20: «solamente dashboard, no texto»). Sin listas de títulos ni
 * párrafos: números, barras y las acciones justas.
 *
 *   · La próxima misa, arriba: fecha, nombre y el anillo (solo director).
 *     Se entra por «Ver la misa»; adentro se toca un canto y se avanza con la
 *     flecha. El botón «Empezar la misa» se fue (2026-11-20).
 *   · Indicadores: cuántos cantos están en ensayo y cuántos listos, con su
 *     barra; cuántos miembros tiene el coro y cómo se componen (solo director).
 *   · Las más cantadas: el ranking con su barra, para ver la intensidad de uso.
 *
 * La participación («¿Vas?») se queda en el hero: es una acción, no un dato.
 * «Más cantadas» y «En ensayo» los ven todos; «Miembros» es del director.
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

  // Las más cantadas: el top 3 de los que ya sonaron alguna vez (H13). La
  // barra compara cada uno con el primero: es la «regleta» que pidió el dueño.
  const masCantadas = ordenarPorUso(conHistorial)
    .filter((c) => c.historial.veces > 0)
    .slice(0, 3)
  const masVeces = masCantadas[0]?.historial.veces ?? 1

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
              </div>
            </div>

            {/* Sin «Empezar la misa» (2026-11-20): se entra por «Ver la misa»
                y, adentro, se toca un canto y se avanza con la flecha. El
                director, si no hay cantos, arma la misa en su lugar. */}
            <div className="mt-5 flex flex-wrap items-center gap-2">
              {puedeEditarMisa && misa.cantos.length === 0 && (
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

        {/* El tablero (2026-11-20): indicadores, no listas de títulos. */}
        <section aria-label="Indicadores del coro" className="mt-6 grid grid-cols-2 gap-3">
          <Tarjeta
            href="/repertorio?vista=todas&estado=en_ensayo"
            etiqueta="En ensayo"
            valor={enEnsayo.length}
            className={puedeVerFichas ? '' : 'col-span-2'}
          >
            <span className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-superficie-alta" aria-hidden>
              <span className="bg-acento" style={{ width: `${proporcionListos}%` }} />
            </span>
            <span className="text-sm text-texto-tenue">
              <span className="font-semibold text-texto tabular-nums">{listos.length}</span> listos
            </span>
          </Tarjeta>

          {puedeVerFichas && (
            <Tarjeta href="/coro/miembros" etiqueta="Miembros" valor={fichas.length}>
              <span className="text-sm text-texto-tenue">
                {directores} {directores === 1 ? 'director' : 'directores'}
              </span>
              <span className="text-sm text-texto-tenue">
                {miembros} {miembros === 1 ? 'miembro' : 'miembros'} · {conCuerda} con cuerda
              </span>
            </Tarjeta>
          )}
        </section>

        <section
          aria-labelledby="mas-cantadas"
          className="mt-3 rounded-2xl border border-borde bg-superficie p-4"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="mas-cantadas" className="text-[0.9375rem] font-bold text-texto">
              Las más cantadas
            </h2>
            <Link
              href="/historial"
              className="tactil -my-2 inline-flex shrink-0 items-center gap-0.5 rounded-lg px-1 text-sm text-texto-tenue hover:text-texto"
            >
              Historial
              <IconoSeguir tamano={14} className="shrink-0" />
            </Link>
          </div>

          {masCantadas.length > 0 ? (
            <ol className="mt-3 flex flex-col gap-3">
              {masCantadas.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/repertorio/${c.id}`}
                    className="tactil -mx-1 flex flex-col gap-1.5 rounded-lg px-1 py-1 hover:bg-superficie-alta"
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate">{c.titulo}</span>
                      <span className="shrink-0 text-sm font-bold text-acento tabular-nums">
                        {c.historial.veces}×
                      </span>
                    </span>
                    <span className="flex h-1.5 overflow-hidden rounded-full bg-fondo" aria-hidden>
                      <span
                        className="rounded-full bg-acento"
                        style={{
                          width: `${Math.max(8, Math.round((100 * c.historial.veces) / masVeces))}%`,
                        }}
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-texto-tenue">Todavía no hay historial.</p>
          )}
        </section>
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

/** Una tarjeta del tablero: un número grande y su lectura. Toda la tarjeta es el enlace. */
function Tarjeta({
  href,
  etiqueta,
  valor,
  className = '',
  children,
}: {
  href: string
  etiqueta: string
  valor: number
  className?: string
  children?: ReactNode
}) {
  return (
    <Link
      href={href}
      className={`tactil flex flex-col gap-1 rounded-2xl border border-borde bg-superficie p-4 transition-colors hover:border-borde-fuerte ${className}`}
    >
      <span className="text-sm text-texto-tenue">{etiqueta}</span>
      <span className="text-[2.25rem] leading-none font-bold tabular-nums text-texto">{valor}</span>
      {children}
    </Link>
  )
}
