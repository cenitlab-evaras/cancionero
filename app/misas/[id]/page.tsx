import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { obtenerMisa } from '@/lib/datos/misas'
import { inscritosDeMisa } from '@/lib/datos/inscripciones'
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
import Cabecera from '@/app/componentes/cabecera'
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
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <h1 className="text-lg font-semibold text-peligro">
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
  const [inscritos, fichas] = await Promise.all([
    puedeVerQuienVa ? inscritosDeMisa(misa.id) : Promise.resolve([]),
    puede(sesion.sujeto, 'ver_ficha_del_coro') ? fichasDelCoro(misa.coroId) : Promise.resolve([]),
  ])

  const miInscripcion = inscritos.find((i) => i.perfilId === sesion.usuarioId) ?? null
  const resumen = resumirCoro(inscritos, fichas)
  // `fichasDelCoro` lista a todo el coro, así que quien no la puede leer
  // tampoco puede saber quién falta: la lista queda vacía y no se dibuja.
  const faltan = quienFalta(fichas, inscritos, fichas)
  const abierta = sePuedeInscribir(misa.fecha, hoyISO())

  return (
    <>
      <Cabecera sesion={sesion} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-10">
        <div className="flex items-baseline gap-3 pt-4">
          <Link
            href="/misas"
            className="-ml-1 shrink-0 rounded px-1 text-sm text-texto-tenue transition-colors hover:text-texto"
            aria-label="Volver a las misas"
          >
            ←
          </Link>
          <h1 className="min-w-0 text-[1.375rem] leading-tight font-semibold text-balance">
            {misa.nombre}
          </h1>
        </div>

        <div className="mt-1.5 flex items-baseline justify-between gap-3 pl-7">
          <p className="text-xs text-texto-tenue">
            {misa.cantos.length === 0
              ? 'sin cantos'
              : misa.cantos.length === 1
                ? '1 canto'
                : `${misa.cantos.length} cantos`}
          </p>
          {puedeEditar && (
            <Link href={`/misas/${misa.id}/editar`} className="text-sm text-acento">
              Armar
            </Link>
          )}
        </div>

        {misa.cantos.length === 0 ? (
          <p className="mt-8 max-w-prose text-sm text-texto-tenue">
            Esta misa todavía no tiene cantos.
            {puedeEditar
              ? ' Toca «Armar» para asignarle uno por momento.'
              : ' Cuando tu director la arme, aparecen acá.'}
          </p>
        ) : (
          <>
            <ol className="mt-4 divide-y divide-borde border-t border-borde">
              {misa.cantos.map((c, i) => (
                <li key={c.id}>
                  <Link
                    href={`/misas/${misa.id}/${c.id}`}
                    className="flex min-h-14 items-center gap-3 py-2 transition-colors hover:bg-superficie"
                  >
                    <span className="w-5 shrink-0 text-right font-cifrado text-xs text-texto-tenue">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{c.titulo}</span>
                      <span className="block text-xs text-texto-tenue">{c.momentoNombre}</span>
                    </span>
                    {c.tonalidadOriginal && (
                      <span className="shrink-0 font-cifrado text-sm text-acorde">
                        {c.tonalidadOriginal}
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ol>

            <Link
              href={`/misas/${misa.id}/${misa.cantos[0].id}`}
              className="tactil mt-6 flex items-center justify-center rounded-lg bg-acento font-medium text-white"
            >
              Empezar la misa
            </Link>
          </>
        )}

        {/* H15 · Quién va. Debajo de los cantos porque la misa es lo primero;
            arriba de todo estaría compitiendo con lo que se viene a leer. */}
        {puedeVerQuienVa && (
          <section className="mt-10 border-t border-borde pt-6">
            <h2 className="text-[0.8125rem] font-semibold text-texto-tenue uppercase">Quién va</h2>

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
                <p className="mt-5 text-xs text-texto-tenue">
                  {resumen.total} {resumen.total === 1 ? 'anotado' : 'anotados'}
                  {resumen.voces.map((v) => (
                    <span key={v.tesitura ?? 'sin'}>
                      {' · '}
                      {contarVoces(v.tesitura, v.cuantos)}
                    </span>
                  ))}
                  {resumen.instrumentos.map((i) => (
                    <span key={i.instrumento ?? 'sin'}>
                      {' · '}
                      {contarInstrumento(i.instrumento, i.cuantos)}
                    </span>
                  ))}
                </p>

                <ul className="mt-2 divide-y divide-borde border-t border-borde">
                  {inscritos.map((i) => (
                    <li key={i.perfilId} className="flex min-h-12 items-center gap-3 py-1.5">
                      <span className="min-w-0 flex-1 truncate text-sm">{i.nombre}</span>
                      <span className="shrink-0 text-xs text-texto-tenue">
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
              <p className="mt-4 max-w-prose text-xs text-texto-tenue">
                Faltan {faltan.length}
                {faltan.map((f) => (
                  <span key={f.perfilId}>
                    {' · '}
                    {f.nombre}
                    {f.disponibilidad && ` (${etiquetaDisponibilidad(f.disponibilidad).toLowerCase()})`}
                  </span>
                ))}
              </p>
            )}
          </section>
        )}
      </main>
    </>
  )
}
