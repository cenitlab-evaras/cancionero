import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede, rutaInicial } from '@/lib/permisos'
import { misasDelCoro, obtenerMisa, type MisaDeLista } from '@/lib/datos/misas'
import { hoyISO } from '@/lib/datos/historial'
import { agruparMisas, misaDeInicio } from '@/lib/motores/agenda'
import { cuantoFalta, partesDeFecha } from '@/lib/motores/fecha'
import Cabecera from '@/app/componentes/cabecera'
import Ayuda from '@/app/componentes/ayuda'
import { clasesBotonIcono } from '@/app/componentes/boton-icono'
import {
  IconoEditar,
  IconoLista,
  IconoReproducir,
  IconoSeguir,
} from '@/app/componentes/iconos'

export const metadata = { title: 'Hoy · Cantoral' }

/**
 * Hoy: la bandeja de entrada de las misas (rediseño 2026-11-25, maqueta
 * elegida por el dueño; la forma sale de la bandeja del CRM).
 *
 *   · La próxima misa arriba, con sus acciones: «Empezar» si tiene cantos,
 *     «Armar» si el director todavía no los cargó, y «La misa».
 *   · Las siguientes, como items con la fecha a la izquierda y el estado en el
 *     filo y la píldora: «Sin cantos» pide atención y va en rojo; «Lista» es una
 *     misa con cantos.
 *   · Las pasadas no ocupan la bandeja: quedan en Misas, con una línea para
 *     llegar.
 *
 * La complejidad y el contexto viven en «La misa»; acá no compiten. La raíz
 * sigue repartiendo con `rutaInicial()` (PRD §8.3).
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

  const misas = await misasDelCoro(coro.id)
  const agenda = agruparMisas(misas, hoy)
  // La de hoy si la hay; si no, la próxima. Una lista sin fecha no es la
  // próxima misa (`misaDeInicio` ya lo decide así).
  const resumen = misaDeInicio(misas, hoy)
  const misa = resumen ? await obtenerMisa(resumen.id) : null

  const restantes = agenda.proximas.filter((m) => m.id !== resumen?.id)
  const porDelante = (resumen ? 1 : 0) + restantes.length
  // `agruparMisas` cuenta la de hoy como ocurrida (el criterio del historial);
  // en la bandeja, «Ya celebradas» no la incluye.
  const pasadasEsteAnio = agenda.pasadas.filter(
    (m) => m.fecha !== null && m.fecha < hoy && m.fecha.startsWith(hoy.slice(0, 4))
  ).length

  return (
    <>
      <Cabecera sesion={sesion} acciones={<Ayuda />} />

      <main className="mx-auto w-full max-w-2xl px-4 pt-4 pb-10">
        <h1 className="text-[2.125rem] leading-[1.05] font-bold tracking-[-0.02em]">
          Hoy
        </h1>
        {porDelante > 0 && (
          <p className="mt-1 text-sm text-texto-tenue">
            {porDelante === 1 ? '1 misa por delante' : `${porDelante} misas por delante`}
          </p>
        )}

        {resumen && misa ? (
          <>
            <h2 className="mt-5 border-t border-borde pt-4 text-[0.9375rem] font-bold text-texto">
              Bandeja de entrada
            </h2>

            <div className="mt-2 flex flex-col gap-2.5">
              <article>
                <Ficha misa={resumen} hoy={hoy} destacada />
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <Link
                    href={`/misas/${misa.id}`}
                    className={clasesBotonIcono('borde', 'px-3 text-sm')}
                  >
                    <IconoLista tamano={18} />
                    La misa
                  </Link>
                  {misa.cantos.length > 0 && (
                    <Link
                      href={`/misas/${misa.id}/${misa.cantos[0].id}`}
                      className={clasesBotonIcono('lleno', 'px-3 text-sm')}
                    >
                      <IconoReproducir tamano={18} />
                      Empezar
                    </Link>
                  )}
                  {puedeEditarMisa && misa.cantos.length === 0 && (
                    <Link
                      href={`/misas/${misa.id}/editar`}
                      className={clasesBotonIcono('lleno', 'px-3 text-sm')}
                    >
                      <IconoEditar tamano={18} />
                      Armar
                    </Link>
                  )}
                </div>
              </article>

              {restantes.map((m) => (
                <Link
                  key={m.id}
                  href={`/misas/${m.id}`}
                  className="tactil rounded-[10px] transition-colors hover:bg-superficie-alta"
                >
                  <Ficha misa={m} hoy={hoy} conFlecha />
                </Link>
              ))}
            </div>

            {pasadasEsteAnio > 0 && (
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-borde pt-3 text-sm text-texto-tenue">
                <span>
                  Ya celebradas este año: {pasadasEsteAnio}
                </span>
                <Link href="/misas" className="shrink-0 font-semibold text-acento">
                  Ver en Misas
                </Link>
              </div>
            )}
          </>
        ) : (
          <section className="pt-6">
            <div className="min-w-0">
              <h2 className="text-[1.75rem] leading-tight font-bold tracking-[-0.02em] text-balance">
                No hay misas por delante
              </h2>
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

/** El estado de una misa, tal como se ve en el filo y en la píldora. */
function estadoDeMisa(misa: MisaDeLista): {
  texto: string
  filo: string
  pildora: string
} {
  if (misa.fecha === null) {
    return {
      texto: 'Sin fecha',
      filo: 'border-l-acento',
      pildora: 'text-acento bg-acento/10',
    }
  }
  if (misa.cantidadCantos === 0) {
    return {
      texto: 'Sin cantos',
      filo: 'border-l-peligro',
      pildora: 'text-peligro bg-peligro/10',
    }
  }
  return {
    texto: 'Lista',
    filo: 'border-l-exito',
    pildora: 'text-exito bg-exito/10',
  }
}

/**
 * Una ficha de la bandeja: la fecha en su columna, el tiempo y el estado, el
 * nombre y el detalle; la flecha cuando no lleva acciones debajo.
 *
 * `destacada` es la próxima: superficie alta y tipografía un poco mayor, para
 * que la acción que la acompaña se lea como suya.
 */
function Ficha({
  misa,
  hoy,
  destacada = false,
  conFlecha = false,
}: {
  misa: MisaDeLista
  hoy: string
  destacada?: boolean
  conFlecha?: boolean
}) {
  const estado = estadoDeMisa(misa)
  const fecha = misa.fecha ? partesDeFecha(misa.fecha) : null
  const cuando = misa.fecha ? cuantoFalta(misa.fecha, hoy) : null
  const detalle = [
    misa.celebracion ?? misa.lugar,
    misa.cantidadCantos === 1 ? '1 canto' : `${misa.cantidadCantos} cantos`,
    misa.anotados === 1 ? '1 anotado' : `${misa.anotados} anotados`,
  ].filter(Boolean)

  return (
    <div
      className={`flex gap-3 rounded-[10px] border border-borde border-l-[3px] px-3.5 py-3 ${estado.filo} ${
        destacada ? 'bg-superficie-alta' : 'bg-superficie'
      }`}
    >
      <span className="w-[46px] shrink-0 pt-0.5 text-center">
        <span className="titulo-libro block text-[1.5rem] leading-none">
          {fecha?.dia ?? '—'}
        </span>
        <span className="block text-[0.6875rem] uppercase tracking-[0.06em] text-texto-tenue">
          {fecha?.mes ?? 'sin'}
        </span>
        <span className="block text-[0.6875rem] text-texto-tenue">{fecha?.semana ?? 'fecha'}</span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          {cuando && <span className="text-[0.8125rem] font-bold text-acento">{cuando}</span>}
          <span className={`rounded-full px-2 py-0.5 text-[0.6875rem] font-bold ${estado.pildora}`}>
            {estado.texto}
          </span>
        </span>
        <span
          className={`titulo-libro mt-1 block leading-tight text-balance ${
            destacada ? 'text-[1.125rem]' : 'text-[1.0625rem]'
          }`}
        >
          {misa.nombre}
        </span>
        <span className="mt-0.5 block text-[0.8125rem] leading-snug text-texto-tenue">
          {detalle.join(' · ')}
        </span>
      </span>

      {conFlecha && (
        <IconoSeguir tamano={18} className="shrink-0 self-center text-texto-tenue" />
      )}
    </div>
  )
}
