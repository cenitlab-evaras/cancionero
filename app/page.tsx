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
import { avanceDeLaMisa, vocesQueVan, type VocesQueVan } from '@/lib/motores/tablero'
import { CUERDAS_DEL_CORO, nombreDeCuerda } from '@/lib/motores/cuerdas'
import Cabecera from '@/app/componentes/cabecera'
import TituloSeccion from '@/app/componentes/titulo-seccion'
import Anotados from '@/app/componentes/anotados'
import { clasesBotonIcono } from '@/app/componentes/boton-icono'
import { IconoReproducir, IconoSeguir } from '@/app/componentes/iconos'
import Inscripcion from '@/app/misas/[id]/inscripcion'

export const metadata = { title: 'Inicio · Cantoral' }

/**
 * Inicio como tablero (el dueño, 2026-10-17: «no parece dashboard»; eligió la
 * opción B de las maquetas, «¿qué tan lista está la misa?»).
 *
 * Dos vistas de la misma misa:
 *   · El DIRECTOR ve si la misa está lista: un anillo de avance
 *     (`avanceDeLaMisa`), las voces que van por cuerda (`vocesQueVan`, con las
 *     fichas que solo él lee) y las cuatro cosas que faltan para cerrarla,
 *     cada una con su número y llevando a donde se resuelve.
 *   · El MIEMBRO ve qué se canta y con quién: cuántos van a cantar, sus
 *     círculos, y los cantos elegidos.
 * Los dos dicen ahí mismo si van. Debajo, en chico: qué repasar, qué se está
 * ensayando, las misas que vienen y, para el director, lo demás pendiente.
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

  // El tablero del director. Lo que ya cuenta el anillo no se repite abajo.
  const sinResponder = quienFalta(fichas, inscritos, fichas).length
  const tocan = inscritos.filter((i) => i.aporte === 'instrumental').length
  const avance = misa
    ? avanceDeLaMisa({ cantos: misa.cantos, tocan, coro: fichas.length, sinResponder })
    : null
  const voces = vocesQueVan(inscritos, fichas)
  const EN_EL_TABLERO = new Set(['sin-cantos', 'sin-musicos', 'faltan'])
  const otrosPendientes = pendientes.filter((p) => !EN_EL_TABLERO.has(p.clave))

  // La vista del miembro: quiénes van a CANTAR.
  const cantan = new Set(inscritos.filter((i) => i.aporte === 'vocal').map((i) => i.perfilId))
  const quienesCantan = resumen ? resumen.quienes.filter((q) => cantan.has(q.perfilId)) : []

  const esDirector = puedeEditarMisa
  const empezar =
    misa && misa.cantos.length > 0 ? (
      <Link href={`/misas/${misa.id}/${misa.cantos[0].id}`} className={clasesBotonIcono('lleno', 'px-5 text-base')}>
        <IconoReproducir tamano={16} />
        Empezar la misa
      </Link>
    ) : null

  return (
    <>
      <Cabecera sesion={sesion} />

      <main className="mx-auto w-full max-w-2xl px-4 pt-5 pb-10">
        {misa && resumen?.fecha ? (
          <>
            <section aria-labelledby="proxima-misa" className="halo -mx-4 px-4 pt-6 pb-6">
              <div className="flex items-center gap-4">
                {esDirector && avance && <Anillo porcentaje={avance.porcentaje} />}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-acento">
                    {cuantoFalta(resumen.fecha, hoy)}
                    <span className="font-normal text-texto-tenue"> · {fechaLarga(resumen.fecha)}</span>
                  </p>
                  <h1 id="proxima-misa" className="titulo-libro mt-1 text-[1.75rem] leading-[1.1]">
                    {misa.nombre}
                  </h1>
                  {esDirector && avance && (
                    <p className="mt-1 text-sm text-texto-tenue">
                      {avance.porcentaje === 100 ? 'Lista' : `Lista en un ${avance.porcentaje} %`}
                    </p>
                  )}
                </div>
              </div>

              {esDirector && (
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  {empezar ?? (
                    <Link href={`/misas/${misa.id}/editar`} className={clasesBotonIcono('lleno', 'px-5 text-base')}>
                      Armar esta misa
                    </Link>
                  )}
                  <Link href={`/misas/${misa.id}`} className={clasesBotonIcono('borde', 'px-4 text-base')}>
                    Ver la misa
                  </Link>
                </div>
              )}

              {/* «¿Vas?» acá mismo: el mismo control de un toque de la misa. */}
              {puedeAnotarse && (
                <div className="mt-6 border-t border-borde pt-4">
                  <p className="text-[0.9375rem] font-bold">{miInscripcion ? 'Vas a esta misa' : '¿Vas a esta misa?'}</p>
                  <Inscripcion misaId={misa.id} mia={miInscripcion} editable />
                </div>
              )}
            </section>

            {esDirector && avance ? (
              <>
                {/* Las voces por cuerda: «mañana hay un solo bajo», de un vistazo. */}
                <section aria-labelledby="voces" className="mt-6">
                  <TituloSeccion id="voces" detalle={fichas.length > 0 ? `${voces.total} de ${fichas.length}` : undefined}>
                    Voces que van
                  </TituloSeccion>
                  <BarraDeVoces voces={voces} />
                </section>

                <section aria-labelledby="para-que-quede-lista" className="mt-6">
                  <TituloSeccion id="para-que-quede-lista">Para que quede lista</TituloSeccion>
                  <ul className="mt-1 divide-y divide-borde">
                    <FilaDeAvance
                      href={`/misas/${misa.id}/editar`}
                      bien={avance.cantos > 0}
                      numero={String(avance.cantos)}
                      texto={avance.cantos === 1 ? 'canto elegido' : 'cantos elegidos'}
                    />
                    <FilaDeAvance
                      href={`/misas/${misa.id}/editar`}
                      bien={avance.cantos > 0 && avance.conTono === avance.cantos}
                      numero={`${avance.conTono}/${avance.cantos}`}
                      texto="tonos fijados"
                    />
                    <FilaDeAvance
                      href={`/misas/${misa.id}`}
                      bien={avance.tocan > 0}
                      numero={String(avance.tocan)}
                      texto={avance.tocan === 0 ? 'nadie se anotó a tocar' : avance.tocan === 1 ? 'va a tocar' : 'van a tocar'}
                    />
                    <FilaDeAvance
                      href={`/misas/${misa.id}`}
                      bien={avance.sinResponder === 0}
                      numero={String(avance.sinResponder)}
                      texto={avance.sinResponder === 1 ? 'no ha dicho si va' : 'no han dicho si van'}
                    />
                  </ul>
                </section>
              </>
            ) : (
              <>
                <section aria-labelledby="van-a-cantar" className="mt-6">
                  <TituloSeccion id="van-a-cantar">Van a cantar</TituloSeccion>
                  <div className="mt-2 flex items-center gap-4">
                    <span className="titulo-libro text-[2.25rem] leading-none">{quienesCantan.length}</span>
                    <Anotados quienes={quienesCantan} />
                  </div>
                </section>

                <section aria-labelledby="cantos-elegidos" className="mt-6">
                  <TituloSeccion id="cantos-elegidos" detalle={misa.cantos.length > 0 ? String(misa.cantos.length) : undefined}>
                    Cantos elegidos
                  </TituloSeccion>
                  {misa.cantos.length > 0 ? (
                    <>
                      <ol className="mt-1 divide-y divide-borde">
                        {misa.cantos.slice(0, CANTOS_A_LA_VISTA).map((c) => (
                          <li key={c.id} className="flex items-baseline gap-3 py-2">
                            <span className="w-24 shrink-0 text-sm text-texto-tenue">{c.momentoNombre}</span>
                            {/* Sin el tono (el dueño, 2026-10-17: «aquí no se necesita»). */}
                            <span className="min-w-0 flex-1 truncate">{c.titulo}</span>
                          </li>
                        ))}
                      </ol>
                      {misa.cantos.length > CANTOS_A_LA_VISTA && (
                        <Link href={`/misas/${misa.id}`} className="tactil inline-flex items-center text-sm text-texto-tenue underline underline-offset-2">
                          y {misa.cantos.length - CANTOS_A_LA_VISTA} más · ver la misa
                        </Link>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-texto-tenue">Todavía no tiene cantos asignados.</p>
                  )}
                  {/* Para el miembro, después de ver qué se canta (lo aprobado). */}
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {empezar}
                    <Link href={`/misas/${misa.id}`} className={clasesBotonIcono('borde', 'px-4 text-base')}>
                      Ver la misa
                    </Link>
                  </div>
                </section>
              </>
            )}
          </>
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

        {/* Debajo del tablero, en chico (el dueño, 2026-10-17). */}
        <div className="mt-10 grid gap-x-8 gap-y-6 border-t border-borde pt-6 sm:grid-cols-2">
          {otrosPendientes.length > 0 && (
            <Chico titulo="También pendiente">
              {otrosPendientes.map((p) => (
                <FilaChica key={p.clave} href={p.href} texto={p.texto} detalle={p.detalle} />
              ))}
            </Chico>
          )}
          {misa && repasar.length > 0 && (
            <Chico titulo="Para repasar">
              {repasar.map((c) => (
                <FilaChica
                  key={c.id}
                  href={`/repertorio/${c.cantoId}/ensayar?misa=${misa.id}&fila=${c.id}`}
                  texto={c.titulo}
                  detalle={c.momentoNombre}
                />
              ))}
            </Chico>
          )}
          {enEnsayo.length > 0 && (
            <Chico titulo="Se está ensayando">
              {enEnsayo.map((c) => (
                <FilaChica key={c.id} href={`/repertorio/${c.id}`} texto={c.titulo} />
              ))}
            </Chico>
          )}
          {despues.length > 0 && (
            <Chico titulo="Después">
              {despues.map((m) => (
                <FilaChica
                  key={m.id}
                  href={`/misas/${m.id}`}
                  texto={m.nombre}
                  detalle={`${m.fecha ? fechaLarga(m.fecha) : 'Sin fecha'} · ${
                    m.cantidadCantos === 0 ? 'sin cantos' : m.cantidadCantos === 1 ? '1 canto' : `${m.cantidadCantos} cantos`
                  }`}
                />
              ))}
            </Chico>
          )}
        </div>
      </main>
    </>
  )
}

const CANTOS_A_LA_VISTA = 5

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

const COLOR_CUERDA: Record<(typeof CUERDAS_DEL_CORO)[number], string> = {
  soprano: 'var(--color-soprano)',
  contralto: 'var(--color-contralto)',
  tenor: 'var(--color-tenor)',
  bajo: 'var(--color-bajo)',
}

/**
 * Las voces que van, una barra con el color de cada cuerda (los de Ensayar) y
 * su leyenda con números: el color solo no alcanza. «Sin cuerda» es quien no
 * cargó su tesitura, en neutro.
 */
function BarraDeVoces({ voces }: { voces: VocesQueVan }) {
  if (voces.total === 0) return <p className="mt-2 text-sm text-texto-tenue">Todavía nadie se anotó a cantar.</p>
  const tramos = [
    ...CUERDAS_DEL_CORO.map((c) => ({ clave: c, nombre: nombreDeCuerda(c), n: voces[c], color: COLOR_CUERDA[c] })),
    { clave: 'sin', nombre: 'Sin cuerda', n: voces.sinCuerda, color: 'var(--color-borde-fuerte)' },
  ].filter((t) => t.n > 0)
  return (
    <>
      <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-superficie-alta" aria-hidden>
        {tramos.map((t) => (
          <span key={t.clave} style={{ width: `${(100 * t.n) / voces.total}%`, background: t.color }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-texto-tenue">
        {tramos.map((t) => (
          <li key={t.clave} className="flex items-center gap-1.5">
            <span aria-hidden className="size-2.5 rounded-full" style={{ background: t.color }} />
            {t.nombre} <span className="font-bold text-texto">{t.n}</span>
          </li>
        ))}
      </ul>
    </>
  )
}

/** Una de las cuatro cosas que faltan para cerrar la misa: verde si está, rojo si falta. */
function FilaDeAvance({ href, bien, numero, texto }: { href: string; bien: boolean; numero: string; texto: string }) {
  return (
    <li>
      <Link
        href={href}
        className="tactil -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-superficie"
      >
        <span
          className={`min-w-11 rounded-full px-2 py-0.5 text-center text-sm font-bold tabular-nums ${
            bien ? 'bg-exito/15 text-exito' : 'bg-peligro/15 text-peligro'
          }`}
        >
          {bien ? (numero === '0' ? '✓' : `✓ ${numero}`) : numero}
        </span>
        <span className="min-w-0 flex-1 truncate">{texto}</span>
        <IconoSeguir tamano={18} className="shrink-0 text-texto-tenue" />
      </Link>
    </li>
  )
}

/** Una sección de abajo del tablero: título chico y filas chicas. */
function Chico({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs font-bold tracking-wide text-texto-tenue uppercase">{titulo}</h2>
      <ul className="mt-1">{children}</ul>
    </section>
  )
}

function FilaChica({ href, texto, detalle }: { href: string; texto: string; detalle?: string }) {
  return (
    <li>
      <Link
        href={href}
        className="-mx-1.5 flex min-h-9 items-baseline gap-2 rounded px-1.5 py-1 text-sm transition-colors hover:bg-superficie"
      >
        <span className="min-w-0 truncate">{texto}</span>
        {detalle && <span className="min-w-0 shrink truncate text-xs text-texto-tenue">{detalle}</span>}
      </Link>
    </li>
  )
}
