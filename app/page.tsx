import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { obtenerSesion } from '@/lib/sesion'
import { puede, rutaInicial } from '@/lib/permisos'
import { misasDelCoro, obtenerMisa } from '@/lib/datos/misas'
import { repertorioPorMomento } from '@/lib/datos/repertorio'
import { hoyISO, repertorioConHistorial } from '@/lib/datos/historial'
import { misaDeInicio } from '@/lib/motores/agenda'
import { nivelDeComplejidad } from '@/lib/motores/complejidad'
import { etiquetaEstado, type EstadoCanto } from '@/lib/motores/estado-canto'
import { cuantoFalta, fechaLarga } from '@/lib/motores/fecha'
import { tonalidadDeLaFila } from '@/lib/motores/tono-en-la-misa'
import Cabecera from '@/app/componentes/cabecera'
import Ayuda from '@/app/componentes/ayuda'
import ContextoMisa from '@/app/componentes/contexto-misa'
import { clasesBotonIcono } from '@/app/componentes/boton-icono'
import { IconoLista, IconoReproducir } from '@/app/componentes/iconos'
import { guardarContextoDeMisa } from './misas/acciones'

export const metadata = { title: 'Hoy · Cantoral' }

/**
 * Hoy: la próxima misa y nada más (rediseño de lectura, H31).
 *
 * La maqueta `public/maquetas/rediseno-lectura.html` manda el orden: la
 * celebración arriba, el lector a un toque, la biblioteca apartada.
 *
 *   · El título es el de la misa; debajo, cuándo es y cuántos cantos tiene.
 *   · Una fila de acciones: «Empezar» entra al PRIMER canto en el orden
 *     guardado, «La misa» abre la antesala, y el contexto —coro, complejidad,
 *     celebración, lugar— se consulta tocando sus cuatro íconos.
 *   · Debajo, la lista de cantos, con «En ensayo» donde el canto lo está.
 *
 * No hay lecturas: viven en La misa y en el lector (decisión 7 del diseño).
 * Sin misa próxima no se ofrece «Empezar»; el director puede armarla.
 *
 * La complejidad se calcula al leer con `nivelDeComplejidad` (nunca se guarda):
 * el estado de cada canto viene del repertorio y las veces, del historial.
 * `repertorioPorMomento` se lee además para armar ese mapa de estados; el
 * `obtenerMisa` de hoy no lo trae y no se toca en esta tarea.
 *
 * La raíz sigue repartiendo con `rutaInicial()` (PRD §8.3): quien no puede ver
 * un repertorio no ve Hoy, va adonde le corresponde.
 */
export default async function Hoy() {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')

  const destino = rutaInicial(sesion.sujeto)
  if (destino !== '/repertorio') redirect(destino)
  if (!sesion.coroActivo) redirect('/coros')

  const coro = sesion.coroActivo
  const hoy = hoyISO()
  const puedeEditarMisa = puede(sesion.sujeto, 'editar_misa')

  const [misas, grupos, conHistorial] = await Promise.all([
    misasDelCoro(coro.id),
    repertorioPorMomento(coro.id),
    repertorioConHistorial(coro.id),
  ])

  // La misa de hoy si la hay; si no, la próxima. Una lista sin fecha no es la
  // próxima misa (`misaDeInicio` ya lo decide así).
  const resumen = misaDeInicio(misas, hoy)
  const misa = resumen ? await obtenerMisa(resumen.id) : null

  // El estado de cada canto de la misa, y las veces que ya sonó. Se arman como
  // mapas por id: una misa puede repetir el mismo canto en dos momentos.
  const estadoDe = new Map<string, EstadoCanto>()
  for (const grupo of grupos) {
    for (const canto of grupo.cantos) estadoDe.set(canto.id, canto.estado)
  }
  const vecesDe = new Map(conHistorial.map((c) => [c.id, c.historial.veces]))

  const nivel = misa
    ? nivelDeComplejidad(
        misa.cantos.map((c) => ({
          id: c.cantoId,
          estado: estadoDe.get(c.cantoId) ?? 'listo',
          veces: vecesDe.get(c.cantoId) ?? 0,
        }))
      )
    : null
  const cantosDistintos = misa ? new Set(misa.cantos.map((c) => c.cantoId)).size : 0
  const contextoNivel = nivel ? { ...nivel, total: cantosDistintos } : null

  const falta = resumen?.fecha ? cuantoFalta(resumen.fecha, hoy) : null
  const cuentaCantos =
    misa && misa.cantos.length === 1 ? '1 canto' : `${misa?.cantos.length ?? 0} cantos`

  return (
    <>
      <Cabecera sesion={sesion} acciones={<Ayuda />} />

      <main className="mx-auto w-full max-w-2xl px-4 pt-4 pb-10">
        {misa && resumen?.fecha ? (
          <>
            <section aria-labelledby="hoy-misa">
              <div className="min-w-0">
                <h1
                  id="hoy-misa"
                  className="text-[2.5rem] leading-[1.02] font-bold tracking-[-0.02em] text-balance"
                >
                  {misa.nombre}
                </h1>
                <p className="mt-1.5 text-sm text-texto-tenue">
                  {falta && (
                    <>
                      <span className="font-bold text-acento">{falta}</span> ·{' '}
                    </>
                  )}
                  {fechaLarga(resumen.fecha)} · {cuentaCantos}
                </p>
              </div>

              {/* Sin cantos, «Empezar» no existe: no hay a qué entrar. «La misa»
                  queda como la única acción. El lápiz del contexto solo en
                  modo director. */}
              <div className="mt-4 flex items-start justify-between gap-1">
                {misa.cantos.length > 0 && (
                  <AccionHoy
                    href={`/misas/${misa.id}/${misa.cantos[0].id}`}
                    etiqueta="Empezar la misa"
                    texto="Empezar"
                    primaria
                    icono={<IconoReproducir tamano={22} />}
                  />
                )}
                <AccionHoy
                  href={`/misas/${misa.id}`}
                  etiqueta="Ver la misa completa"
                  texto="La misa"
                  icono={<IconoLista tamano={22} />}
                />
                {contextoNivel && (
                  <ContextoMisa
                    misaId={misa.id}
                    coro={coro.nombre}
                    nivel={contextoNivel}
                    celebracion={misa.celebracion}
                    lugar={misa.lugar}
                    puedeEditar={puedeEditarMisa}
                    onGuardarContexto={guardarContextoDeMisa}
                  />
                )}
              </div>
            </section>

            {misa.cantos.length > 0 ? (
              <section aria-labelledby="la-misa-hoy" className="mt-6">
                <h2
                  id="la-misa-hoy"
                  className="border-t border-borde pt-4 text-[0.9375rem] font-bold text-texto"
                >
                  La misa
                </h2>

                <ol className="mt-1 divide-y divide-borde">
                  {misa.cantos.map((c) => {
                    const etiqueta = etiquetaEstado(estadoDe.get(c.cantoId) ?? 'listo')
                    const tono = tonalidadDeLaFila(c.tonalidadOriginal, c.tonoDeMisa)
                    return (
                      <li key={c.id}>
                        <Link
                          href={`/misas/${misa.id}/${c.id}`}
                          className="tactil -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-superficie"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[0.6875rem] text-texto-tenue">
                              {c.momentoNombre}
                              {etiqueta ? ` · ${etiqueta}` : ''}
                            </span>
                            <span
                              className="titulo-libro block truncate text-[1.0625rem] leading-tight"
                              style={{ textWrap: 'nowrap' }}
                            >
                              {c.titulo}
                            </span>
                          </span>
                          {tono && (
                            <span className="shrink-0 font-cifrado text-[0.9375rem] text-acorde">
                              {tono}
                            </span>
                          )}
                        </Link>
                      </li>
                    )
                  })}
                </ol>
              </section>
            ) : (
              <p className="mt-6 border-t border-borde pt-4 text-sm text-texto-tenue">
                {puedeEditarMisa
                  ? 'Esta misa todavía no tiene cantos. Ármala desde «La misa».'
                  : 'Esta misa todavía no tiene cantos. Cuando el director la arme, aparecen acá.'}
              </p>
            )}
          </>
        ) : (
          <section aria-labelledby="sin-misa" className="pt-6">
            <div className="min-w-0">
              <h1
                id="sin-misa"
                className="text-[2.5rem] leading-[1.02] font-bold tracking-[-0.02em] text-balance"
              >
                No hay ninguna misa agendada
              </h1>
              <p className="mt-2 max-w-prose text-texto-tenue prosa-equilibrada">
                {puedeEditarMisa
                  ? 'Agenda la próxima y aparece acá, lista para empezar.'
                  : 'Cuando el director agende la próxima, aparece acá, lista para empezar.'}
              </p>
            </div>

            {puedeEditarMisa && (
              <Link
                href="/misas/nueva"
                className={clasesBotonIcono('lleno', 'mt-5 px-5 text-base')}
              >
                Armar una misa
              </Link>
            )}
          </section>
        )}
      </main>
    </>
  )
}

/**
 * Una de las dos acciones de la fila: el ícono en su caja y la etiqueta debajo.
 *
 * Es la forma de la maqueta (`.accion-icono`): el ícono manda y el texto solo
 * acompaña. La caja mide 46 px y la etiqueta 10,5 px para que «Empezar», «La
 * misa» y los cuatro íconos del contexto entren en una fila a 360 px.
 */
function AccionHoy({
  href,
  etiqueta,
  texto,
  icono,
  primaria = false,
}: {
  href: string
  etiqueta: string
  texto: string
  icono: ReactNode
  primaria?: boolean
}) {
  return (
    <Link
      href={href}
      aria-label={etiqueta}
      className="flex w-[46px] shrink-0 flex-col items-center gap-1.5"
    >
      <span
        className={`grid h-[46px] w-[46px] place-items-center rounded-[14px] border transition-colors ${
          primaria
            ? 'border-acento bg-acento text-sobre-acento hover:brightness-110 active:brightness-95'
            : 'border-borde-fuerte bg-transparent text-texto hover:bg-superficie'
        }`}
      >
        {icono}
      </span>
      <span
        className={`text-[10.5px] font-bold whitespace-nowrap ${
          primaria ? 'text-acento' : 'text-texto-tenue'
        }`}
      >
        {texto}
      </span>
    </Link>
  )
}
