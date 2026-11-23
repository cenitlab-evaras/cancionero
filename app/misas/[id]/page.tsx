import Link from 'next/link'
import FilaCantoMisa from './fila-canto-misa'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { obtenerMisa } from '@/lib/datos/misas'
import { inscritosDeMisa } from '@/lib/datos/inscripciones'
import { sugerenciasDeMisa } from '@/lib/datos/sugerencias'
import { rankear } from '@/lib/motores/sugerencia'
import { fichasDelCoro } from '@/lib/datos/ficha'
import { lecturasDeMisa } from '@/lib/datos/lecturas'
import { preferenciasDelPerfil, repertorioPorMomento } from '@/lib/datos/repertorio'
import { hoyISO, repertorioConHistorial } from '@/lib/datos/historial'
import { nivelDeComplejidad } from '@/lib/motores/complejidad'
import type { EstadoCanto } from '@/lib/motores/estado-canto'
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
import Ayuda from '@/app/componentes/ayuda'
import ContextoMisa from '@/app/componentes/contexto-misa'
import { EnlaceIcono } from '@/app/componentes/boton-icono'
import { IconoEditar, IconoReproducir, IconoVolver } from '@/app/componentes/iconos'
import Inscripcion from './inscripcion'
import BloqueLecturas from './lecturas/bloque'
import ArchivarMisa from './archivar'
import { guardarContextoDeMisa } from '../acciones'

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
          <h1 className="titulo-pantalla leading-tight text-peligro">
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
  const puedeQuitar = puede(sesion.sujeto, 'quitar_canto_misa')
  const puedeVerQuienVa = puede(sesion.sujeto, 'ver_inscripciones')

  // H15. Las fichas solo salen para quien puede leerlas (H14: su dueño y el
  // director). Sin ellas, `resumirCoro` agrupa las voces bajo `null` y la
  // pantalla dice «3 cantan» en vez de desglosar por tesitura — que es la
  // decisión de privacidad de H14 sostenida, no una carencia de este hito.
  const [inscritos, fichas, pedidos, lecturas, preferencias, grupos, conHistorial] =
    await Promise.all([
      puedeVerQuienVa ? inscritosDeMisa(misa.id) : Promise.resolve([]),
      puede(sesion.sujeto, 'ver_ficha_del_coro') ? fichasDelCoro(misa.coroId) : Promise.resolve([]),
      // H17 · lo que el coro pidió PARA ESTA misa. Lo general vive en
      // /sugerencias: son dos preguntas distintas y no se suman.
      puede(sesion.sujeto, 'ver_sugerencias')
        ? sugerenciasDeMisa(misa.id)
        : Promise.resolve([]),
      // H30 · las lecturas y el tamaño de letra de la persona, para la puerta.
      // Las lecturas son un feature aditivo: un error de `misa_lectura` no debe
      // tumbar la misa, así que se degradan a «sin lecturas».
      lecturasDeMisa(misa.id).catch(() => []),
      preferenciasDelPerfil(),
      // H31 · el contexto de la misa: la complejidad se calcula al leer con el
      // estado de cada canto y las veces que ya sonó. Es el mismo patrón de
      // `app/page.tsx`; `repertorioPorMomento` aporta el estado y sobra el resto.
      repertorioPorMomento(misa.coroId),
      repertorioConHistorial(misa.coroId),
    ])
  const pedidosRankeados = rankear(pedidos)

  // El estado de cada canto de la misa y sus veces cantadas, como mapas por id:
  // una misa puede repetir el mismo canto en dos momentos.
  const estadoDe = new Map<string, EstadoCanto>()
  for (const grupo of grupos) {
    for (const canto of grupo.cantos) estadoDe.set(canto.id, canto.estado)
  }
  const vecesDe = new Map(conHistorial.map((c) => [c.id, c.historial.veces]))
  const nivel = nivelDeComplejidad(
    misa.cantos.map((c) => ({
      id: c.cantoId,
      estado: estadoDe.get(c.cantoId) ?? 'listo',
      veces: vecesDe.get(c.cantoId) ?? 0,
    }))
  )
  const contextoNivel = { ...nivel, total: new Set(misa.cantos.map((c) => c.cantoId)).size }
  // El coro que canta es el de la misa, no necesariamente el activo: la cookie
  // puede apuntar a otro y la misa se abre desde el calendario del suyo.
  const coroNombre =
    sesion.coros.find((c) => c.id === misa.coroId)?.nombre ??
    sesion.coroActivo?.nombre ??
    'Tu coro'

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
      <Cabecera sesion={sesion} acciones={<Ayuda />} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-10">
        <div className="-ml-3 pt-2">
          <EnlaceIcono href="/misas" etiqueta="Volver a las misas">
            <IconoVolver />
          </EnlaceIcono>
        </div>

        <h1 className="titulo-pantalla mt-1 leading-tight text-balance">
          {misa.nombre}
        </h1>
        {/* La fecha no aparecía en ninguna parte del detalle: había que volver
            a la lista para saber de qué domingo era. Desde H31 comparte la
            línea con la cuenta de cantos, como el meta de la maqueta. */}
        <p className="mt-1 text-base text-texto-tenue">
          {misa.fecha ? fechaLarga(misa.fecha) : 'Sin fecha'} · {cantos}
        </p>

        {/* H31 · la fila de la maqueta: el ícono manda y la etiqueta solo
            acompaña. La misma acción entra al primer canto; en una misa que ya
            pasó dice «Repasar», no «Empezar» (el criterio de `yaPaso` es el
            mismo del archivar). «Editar» abre el armado completo (la
            celebración y el lugar se editan desde el contexto). El ancho de las
            cajas está calculado para que a 360 px entren las dos acciones y los
            cuatro íconos del contexto. */}
        <div className="mt-4 flex items-start justify-between gap-1">
          {misa.cantos.length > 0 && (
            <AccionMisa
              href={`/misas/${misa.id}/${misa.cantos[0].id}`}
              etiqueta={yaPaso ? 'Repasar la misa' : 'Empezar la misa'}
              texto={yaPaso ? 'Repasar' : 'Empezar'}
              primaria
              icono={<IconoReproducir tamano={22} />}
            />
          )}
          {puedeEditar && (
            <AccionMisa
              href={`/misas/${misa.id}/editar`}
              etiqueta="Editar la misa"
              texto="Editar"
              icono={<IconoEditar tamano={22} />}
            />
          )}
          <ContextoMisa
            misaId={misa.id}
            coro={coroNombre}
            nivel={contextoNivel}
            celebracion={misa.celebracion}
            lugar={misa.lugar}
            puedeEditar={puedeEditar}
            onGuardarContexto={guardarContextoDeMisa}
          />
        </div>

        {/* H30 · Las lecturas, antes de los cantos: van primero en la liturgia.
            El lector y el editor viven dentro del bloque; acá solo se pasa lo
            que ya trajeron las consultas. */}
        <BloqueLecturas
          misaId={misa.id}
          fecha={misa.fecha}
          partes={lecturas}
          esDirector={puedeEditar}
          tamanoLetra={preferencias.tamanoLetra}
          titulo={misa.nombre}
        />

        {misa.cantos.length === 0 ? (
          <p className="mt-8 max-w-prose text-sm text-texto-tenue">
            Esta misa todavía no tiene cantos.
            {puedeEditar
              ? ' Toca «Editar» para asignarle uno por momento.'
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
                // El director la desliza a la izquierda para quitarla.
                <FilaCantoMisa
                  key={c.id}
                  misaId={misa.id}
                  filaId={c.id}
                  titulo={c.titulo}
                  momento={c.momentoNombre}
                  tono={tonalidadDeLaFila(c.tonalidadOriginal, c.tonoDeMisa)}
                  puedeQuitar={puedeQuitar}
                />
              ))}
            </ol>

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
                    {/* H30 · El «por qué» de cada pedido, con quien lo dejó. */}
                    {f.notas.length > 0 && (
                      <ul className="mt-1 space-y-0.5">
                        {f.notas.map((n, i) => (
                          <li key={i} className="text-sm text-texto-tenue">
                            «{n.texto}»{n.nombre ? ` — ${n.nombre}` : ''}
                          </li>
                        ))}
                      </ul>
                    )}
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
                <TituloSeccion
                  detalle={String(faltan.length)}
                  detalleHablado={faltan.length === 1 ? '1 persona' : `${faltan.length} personas`}
                >
                  {faltan.length === 1 ? 'Falta' : 'Faltan'}
                </TituloSeccion>
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

        {/* La misa vieja se archiva desde acá (2026-11-23): sale de la app y
            queda en la base como respaldo. Solo se ofrece cuando ya pasó, que
            es exactamente lo que la acción acepta. La confirmación vive en la
            isla, porque archivar es destructivo y el gesto anterior la pedía. */}
        {yaPaso && puedeEditar && <ArchivarMisa misaId={misa.id} />}
      </main>
    </>
  )
}

/**
 * Una de las acciones de la cabecera de la misa: el ícono en su caja y la
 * etiqueta debajo, como `.accion-icono` de la maqueta y `AccionHoy`.
 *
 * La caja mide 46 px y la etiqueta 10,5 px para que «Empezar», «Editar» y los
 * cuatro íconos del contexto entren en una fila a 360 px sin scroll horizontal.
 */
function AccionMisa({
  href,
  etiqueta,
  texto,
  icono,
  primaria = false,
}: {
  href: string
  etiqueta: string
  texto: string
  icono: React.ReactNode
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
