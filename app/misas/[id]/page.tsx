import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { obtenerMisa } from '@/lib/datos/misas'
import { inscritosDeMisa } from '@/lib/datos/inscripciones'
import { sugerenciasDeMisa } from '@/lib/datos/sugerencias'
import { rankear } from '@/lib/motores/sugerencia'
import { fichasDelCoro } from '@/lib/datos/ficha'
import { hoyISO } from '@/lib/datos/historial'
import {
  contarInstrumento,
  contarVoces,
  etiquetaAporte,
  nombreInstrumento,
  quienFalta,
  resumirCoro,
  sePuedeInscribir,
} from '@/lib/motores/inscripcion'
import { etiquetaDisponibilidad } from '@/lib/motores/ficha'
import { fechaLarga } from '@/lib/motores/fecha'
import { tonalidadDeLaFila } from '@/lib/motores/tono-en-la-misa'
import Cabecera from '@/app/componentes/cabecera'
import TituloSeccion from '@/app/componentes/titulo-seccion'
import { EnlaceIcono, clasesBotonIcono } from '@/app/componentes/boton-icono'
import { IconoEditar, IconoReproducir, IconoVolver } from '@/app/componentes/iconos'
import Inscripcion from './inscripcion'

export const metadata = { title: 'Misa · Cantoral' }

/**
 * La misa, en el orden en que se canta.
 *
 * Es la antesala de la vista de ejecución: desde acá se entra al primer canto y
 * ya no se vuelve — de eso se encarga la navegación de `[filaId]`.
 */
export default async function MisaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  const { id } = await params
  const misa = await obtenerMisa(id)

  // Cero filas por RLS no es un estado vacío: es falta de acceso (PRD §14).
  if (!misa) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-10">
          <h1 className="titulo-libro text-[1.75rem] leading-tight text-peligro">
            No tienes acceso a esta misa
          </h1>
          <p className="mt-2 max-w-prose text-sm text-texto-tenue">
            Pertenece a un coro del que no eres parte, o ya no existe.
          </p>
          <Link
            href="/misas"
            className="mt-6 inline-block text-sm text-acento underline underline-offset-2"
          >
            Volver a las misas
          </Link>
        </main>
      </>
    )
  }

  const puedeEditar = puede(sesion.sujeto, 'editar_misa')
  const puedeVerQuienVa = puede(sesion.sujeto, 'ver_inscripciones')

  // H15. Las fichas solo salen para quien puede leerlas (H14: su dueño y el
  // director). Sin ellas, `resumirCoro` agrupa las voces bajo `null` y la
  // pantalla dice «3 cantan» en vez de desglosar por tesitura — que es la
  // decisión de privacidad de H14 sostenida, no una carencia de este hito.
  const [inscritos, fichas, pedidos] = await Promise.all([
    puedeVerQuienVa ? inscritosDeMisa(misa.id) : Promise.resolve([]),
    puede(sesion.sujeto, 'ver_ficha_del_coro') ? fichasDelCoro(misa.coroId) : Promise.resolve([]),
    // H17 · lo que el coro pidió PARA ESTA misa. Lo general vive en
    // /sugerencias: son dos preguntas distintas y no se suman.
    puede(sesion.sujeto, 'ver_sugerencias')
      ? sugerenciasDeMisa(misa.id)
      : Promise.resolve([]),
  ])
  const pedidosRankeados = rankear(pedidos)

  const miInscripcion = inscritos.find((i) => i.perfilId === sesion.usuarioId) ?? null
  const resumen = resumirCoro(inscritos, fichas)
  // `fichasDelCoro` lista a todo el coro, así que quien no la puede leer
  // tampoco puede saber quién falta: la lista queda vacía y no se dibuja.
  const faltan = quienFalta(fichas, inscritos, fichas)
  const hoy = hoyISO()
  const abierta = sePuedeInscribir(misa.fecha, hoy)
  // «Empezar la misa» es para la que viene. En una que ya pasó, el botón en el
  // halo invitaba a «empezar» algo que ya ocurrió; ahí queda un enlace tenue
  // para repasar. Una misa sin fecha (una lista) se puede empezar siempre.
  const yaPaso = !!misa.fecha && misa.fecha < hoy

  const cantos =
    misa.cantos.length === 0
      ? 'Sin cantos'
      : misa.cantos.length === 1
        ? '1 canto'
        : `${misa.cantos.length} cantos`

  return (
    <>
      <Cabecera sesion={sesion} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-10">
        <div className="-ml-3 pt-2">
          <EnlaceIcono href="/misas" etiqueta="Volver a las misas">
            <IconoVolver />
          </EnlaceIcono>
        </div>

        <h1 className="titulo-libro mt-1 text-[1.75rem] leading-tight text-balance">
          {misa.nombre}
        </h1>
        {/* La fecha no aparecía en ninguna parte del detalle: había que volver
            a la lista para saber de qué domingo era. */}
        <p className="mt-1 text-base text-texto-tenue">
          {misa.fecha ? fechaLarga(misa.fecha) : 'Sin fecha'}
        </p>

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-sm text-texto-tenue">{cantos}</p>
          {puedeEditar && (
            <EnlaceIcono
              href={`/misas/${misa.id}/editar`}
              etiqueta="Armar la misa"
              texto="Armar la misa"
              apariencia="borde"
              className="pr-4"
            >
              <IconoEditar tamano={18} />
            </EnlaceIcono>
          )}
        </div>

        {misa.cantos.length === 0 ? (
          <p className="mt-8 max-w-prose text-sm text-texto-tenue">
            Esta misa todavía no tiene cantos.
            {puedeEditar
              ? ' Toca «Armar la misa» para asignarle uno por momento.'
              : ' Cuando tu director la arme, aparecen acá.'}
          </p>
        ) : (
          <>
            {/* Sin el número de orden a la izquierda: el orden ya lo dice la
                lista, y esa columna es la del número del cancionero en el
                resto de la app. El momento va debajo del título, en tenue. La
                tonalidad sí va en ámbar: es un acorde. */}
            <ol className="mt-4 divide-y divide-borde border-t border-borde">
              {misa.cantos.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/misas/${misa.id}/${c.id}`}
                    className="-mx-2 flex min-h-14 items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-superficie"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-base">{c.titulo}</span>
                      <span className="block text-sm text-texto-tenue">{c.momentoNombre}</span>
                    </span>
                    {/* H27 · el tono en que va EN ESTA MISA, si el director
                        lo fijó; si no, el original del cifrado. */}
                    {tonalidadDeLaFila(c.tonalidadOriginal, c.tonoDeMisa) && (
                      <span className="shrink-0 font-cifrado text-sm text-acorde">
                        {tonalidadDeLaFila(c.tonalidadOriginal, c.tonoDeMisa)}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ol>

            {yaPaso ? (
              <Link
                href={`/misas/${misa.id}/${misa.cantos[0].id}`}
                className="tactil mt-4 inline-flex items-center text-sm text-acento underline underline-offset-2"
              >
                Repasar los cantos
              </Link>
            ) : (
              <Link
                href={`/misas/${misa.id}/${misa.cantos[0].id}`}
                className={clasesBotonIcono('lleno', 'mt-6 w-full gap-2 text-base')}
              >
                <IconoReproducir />
                Empezar la misa
              </Link>
            )}
          </>
        )}

        {/* H17 · Lo que el coro pidió para este domingo. Va antes de «Quién va»
            porque habla de la misa; quién va habla de las personas. Y solo
            aparece si alguien pidió algo: un bloque vacío en cada misa sería
            ruido en la pantalla que se abre para tocar. */}
        {pedidosRankeados.length > 0 && (
          <section className="mt-10 border-t border-borde pt-6">
            <TituloSeccion>Pedidos para esta misa</TituloSeccion>
            <ul className="mt-2 divide-y divide-borde border-t border-borde">
              {pedidosRankeados.map((f) => (
                <li key={`${f.cantoId}·${f.momentoId}`} className="flex items-start gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <Link
                      href={`/repertorio/${f.cantoId}`}
                      className="block truncate text-base hover:underline"
                    >
                      {f.titulo}
                    </Link>
                    <span className="block text-sm text-texto-tenue">{f.momentoNombre}</span>
                    <span className="block text-sm text-texto-tenue">
                      Lo {f.quienes.length === 1 ? 'pide' : 'piden'} {f.quienes.join(', ')}
                    </span>
                  </span>
                  {/* El contador no es un acorde: va en tenue y con su unidad. */}
                  <span className="shrink-0 text-sm text-texto-tenue">
                    {f.cuantas} {f.cuantas === 1 ? 'pedido' : 'pedidos'}
                  </span>
                </li>
              ))}
            </ul>
            {puedeEditar && (
              <p className="mt-2 text-sm text-texto-tenue">
                Pedir no es asignar: los metes tú desde «Armar la misa».
              </p>
            )}
          </section>
        )}

        {/* H15 · Quién va. Debajo de los cantos porque la misa es lo primero;
            arriba de todo estaría compitiendo con lo que se viene a leer. */}
        {puedeVerQuienVa && (
          <section className="mt-10 border-t border-borde pt-6">
            <TituloSeccion
              detalle={
                resumen.total > 0
                  ? `${resumen.total} ${resumen.total === 1 ? 'anotado' : 'anotados'}`
                  : undefined
              }
            >
              Quién va
            </TituloSeccion>

            <Inscripcion misaId={misa.id} mia={miInscripcion} editable={abierta} />

            {resumen.total === 0 ? (
              // Un estado vacío explica POR QUÉ está vacío (§14).
              <p className="mt-5 max-w-prose text-sm text-texto-tenue">
                {abierta
                  ? 'Todavía no se anotó nadie. Sé el primero y el resto del coro lo va a ver.'
                  : 'Nadie se anotó a esta misa.'}
              </p>
            ) : (
              <>
                {/* El desglose por voz e instrumento, cada uno con su espacio:
                    antes era una sola línea de 12 px cosida con puntos medios. */}
                <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-texto-tenue">
                  {resumen.voces.map((v) => (
                    <li key={v.tesitura ?? 'sin'}>{contarVoces(v.tesitura, v.cuantos)}</li>
                  ))}
                  {resumen.instrumentos.map((i) => (
                    <li key={i.instrumento ?? 'sin'}>
                      {contarInstrumento(i.instrumento, i.cuantos)}
                    </li>
                  ))}
                </ul>

                <ul className="mt-2 divide-y divide-borde border-t border-borde">
                  {inscritos.map((i) => (
                    <li key={i.perfilId} className="flex min-h-12 items-center gap-3 py-1.5">
                      <span className="min-w-0 flex-1 truncate">{i.nombre}</span>
                      <span className="shrink-0 text-sm text-texto-tenue">
                        {i.aporte === 'vocal'
                          ? etiquetaAporte(i.aporte)
                          : nombreInstrumento(i.instrumento)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* La disponibilidad del perfil (H14) solo habla de quien TODAVÍA
                no habló: en cuanto alguien se anota sale de acá, y su
                predicción deja de mostrarse. Es la tensión de §18-11, cerrada:
                manda la inscripción. */}
            {faltan.length > 0 && (
              <div className="mt-6">
                <TituloSeccion detalle={String(faltan.length)}>Faltan</TituloSeccion>
                <ul className="mt-2 divide-y divide-borde border-t border-borde">
                  {faltan.map((f) => (
                    <li key={f.perfilId} className="flex min-h-11 items-center gap-3 py-1.5">
                      <span className="min-w-0 flex-1 truncate text-texto-tenue">{f.nombre}</span>
                      {f.disponibilidad && (
                        <span className="shrink-0 text-sm text-texto-tenue">
                          {etiquetaDisponibilidad(f.disponibilidad)}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </main>
    </>
  )
}
