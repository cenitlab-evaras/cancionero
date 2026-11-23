import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { misasDelCoro, obtenerMisa, type MisaDeLista } from '@/lib/datos/misas'
import { lecturasDeMisa, type LecturaGuardada } from '@/lib/datos/lecturas'
import { sugerenciasDeMisa } from '@/lib/datos/sugerencias'
import { hoyISO } from '@/lib/datos/historial'
import { diasConMisa, marcasDeDia } from '@/lib/motores/calendario'
import { fechaLarga } from '@/lib/motores/fecha'
import { NOMBRE_DE_PARTE } from '@/lib/motores/lecturas'
import { rankear, type Sugerencia } from '@/lib/motores/sugerencia'
import Cabecera from '@/app/componentes/cabecera'
import TituloSeccion from '@/app/componentes/titulo-seccion'
import { EnlaceIcono } from '@/app/componentes/boton-icono'
import { IconoAgregar, IconoSeguir } from '@/app/componentes/iconos'
import Calendario from './calendario'

export const metadata = { title: 'Misas · Cantoral' }

/**
 * Misas: el calendario del mes — H31, docs/PRD.md §17.
 *
 * La lista agrupada («Lo que viene», «Ya celebradas», «Sin fecha») se fue en el
 * rediseño de lectura. La pregunta sigue siendo la misma —qué misa viene—, pero
 * ahora se contesta mirando un mes entero y tocando un día: el detalle muestra
 * la celebración, las lecturas y lo que el coro propuso.
 *
 * El mes y el día viven en la URL (`?mes=AAAA-MM&dia=AAAA-MM-DD`): la pantalla
 * es un Server Component y los enlaces hacen que «atrás» recorra lo que se
 * miró. Las misas sin fecha no entran al calendario; siguen existiendo en la
 * base y se alcanzan desde su propia pantalla.
 */

const RE_MES = /^\d{4}-(0[1-9]|1[0-2])$/
const RE_DIA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/

/** `AAAA-MM-DD` que existe de verdad (rechaza 2026-02-31). */
function esDiaValido(iso: string): boolean {
  if (!RE_DIA.test(iso)) return false
  const [anio, mes, dia] = iso.split('-').map(Number)
  const fecha = new Date(Date.UTC(anio, mes - 1, dia))
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  )
}

function diasEntre(a: string, b: string): number {
  const [anioA, mesA, diaA] = a.split('-').map(Number)
  const [anioB, mesB, diaB] = b.split('-').map(Number)
  return Math.round(
    (Date.UTC(anioA, mesA - 1, diaA) - Date.UTC(anioB, mesB - 1, diaB)) / 86_400_000
  )
}

/**
 * El día que se abre si la URL no pide uno: el día con misa más cercano a hoy.
 * Un mes sin misas cae en el 1, y el calendario igual se dibuja completo.
 */
function diaPorDefecto(dias: Set<string>, hoy: string, anio: number, mes: number): string {
  const primero = `${anio}-${String(mes + 1).padStart(2, '0')}-01`
  if (dias.size === 0) return primero

  const distancia = (iso: string) => Math.abs(diasEntre(iso, hoy))
  return [...dias].sort((a, b) => distancia(a) - distancia(b) || a.localeCompare(b))[0] ?? primero
}

type DetalleDeMisa = {
  completa: Awaited<ReturnType<typeof obtenerMisa>>
  lecturas: LecturaGuardada[]
  propuestas: Sugerencia[]
}

export default async function MisasPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; dia?: string }>
}) {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  const puedeEditar = puede(sesion.sujeto, 'editar_misa')
  const verPropuestas = puede(sesion.sujeto, 'ver_sugerencias')

  // Vacío legítimo, NO falta de acceso: el usuario está aprobado pero todavía
  // no lo agregaron a ningún coro (PRD §14).
  if (!sesion.coroActivo) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-10">
          <h1 className="titulo-pantalla leading-tight">Misas</h1>
          <p className="mt-2 text-sm text-texto-tenue">
            Todavía no perteneces a ningún coro. Pídele a tu director que te agregue.
          </p>
        </main>
      </>
    )
  }

  const sp = await searchParams
  const hoy = hoyISO()
  const mesParam =
    typeof sp.mes === 'string' && RE_MES.test(sp.mes) ? sp.mes : hoy.slice(0, 7)
  const anio = Number(mesParam.slice(0, 4))
  // `Date` y el motor del calendario usan el mes 0-indexado.
  const mes = Number(mesParam.slice(5, 7)) - 1

  const misas = await misasDelCoro(sesion.coroActivo.id)
  const dias = diasConMisa(misas, { anio, mes })

  const pedido = typeof sp.dia === 'string' && esDiaValido(sp.dia) ? sp.dia : null
  // Un día de otro mes en la URL no se mezcla con la grilla que se está viendo.
  const seleccionado =
    pedido && pedido.startsWith(`${mesParam}-`)
      ? pedido
      : diaPorDefecto(dias, hoy, anio, mes)

  // Las misas que caen en ESTE mes. `misasDelCoro` ya trae el orden por fecha
  // descendente y excluye las archivadas; acá solo se separa el mes.
  const misasDelMes = misas.filter((m) => m.fecha && dias.has(m.fecha))

  const porDia = new Map<string, MisaDeLista[]>()
  for (const misa of misasDelMes) {
    if (!misa.fecha) continue
    const lista = porDia.get(misa.fecha) ?? []
    lista.push(misa)
    porDia.set(misa.fecha, lista)
  }

  // Por cada misa del mes: la misa completa (celebración), sus lecturas y sus
  // propuestas. Son pocas por mes y van en paralelo; el detalle del día reusa
  // lo que ya se trajo para el resumen, sin una segunda vuelta de consultas.
  const entradas = await Promise.all(
    misasDelMes.map(async (misa): Promise<[string, DetalleDeMisa]> => {
      const [completa, lecturas, propuestas] = await Promise.all([
        obtenerMisa(misa.id),
        // Las lecturas son un feature aditivo: si fallan, la pantalla sigue y
        // el día dice que no hay lecturas (mismo criterio que La misa).
        lecturasDeMisa(misa.id).catch((): LecturaGuardada[] => []),
        verPropuestas
          ? sugerenciasDeMisa(misa.id).catch((): Sugerencia[] => [])
          : Promise.resolve<Sugerencia[]>([]),
      ])
      return [misa.id, { completa, lecturas, propuestas }]
    })
  )
  const detalles = new Map(entradas)

  const marcas: Record<string, { libro: boolean; punto: boolean }> = {}
  const celebraciones: Record<string, string> = {}
  let conLecturas = 0
  let propuestasDelMes = 0

  for (const [fecha, lista] of porDia) {
    let lecturasDelDia = 0
    let propuestasDelDia = 0

    for (const misa of lista) {
      const detalle = detalles.get(misa.id)
      const cantidadLecturas = detalle?.lecturas.length ?? 0
      const cantidadPropuestas = detalle?.propuestas.length ?? 0

      lecturasDelDia += cantidadLecturas
      propuestasDelDia += cantidadPropuestas
      if (cantidadLecturas > 0) conLecturas += 1
      propuestasDelMes += cantidadPropuestas
    }

    marcas[fecha] = marcasDeDia(lecturasDelDia, propuestasDelDia)
    celebraciones[fecha] = lista
      .map((misa) => detalles.get(misa.id)?.completa?.celebracion ?? misa.nombre)
      .join(' · ')
  }

  const resumen = `${misasDelMes.length} ${
    misasDelMes.length === 1 ? 'misa' : 'misas'
  } · ${conLecturas} con lecturas · ${propuestasDelMes} ${
    propuestasDelMes === 1 ? 'propuesta' : 'propuestas'
  }`

  const misasDelDia = porDia.get(seleccionado) ?? []
  const misaDelDia = misasDelDia[0]
  const detalle = misaDelDia ? detalles.get(misaDelDia.id) : undefined
  const celebracion = detalle?.completa?.celebracion ?? misaDelDia?.nombre ?? null
  const lecturas = detalle?.lecturas ?? []
  const propuestas = rankear(detalle?.propuestas ?? [])

  return (
    <>
      <Cabecera sesion={sesion} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-10">
        <div className="flex items-center justify-between gap-3">
          <h1 className="titulo-pantalla leading-tight">Misas</h1>
          {puedeEditar && (
            <EnlaceIcono
              href="/misas/nueva"
              etiqueta="Nueva misa"
              apariencia="lleno"
              className="mr-1"
            >
              <IconoAgregar tamano={18} />
            </EnlaceIcono>
          )}
        </div>

        <Calendario
          anio={anio}
          mes={mes}
          seleccionado={seleccionado}
          resumen={resumen}
          marcas={marcas}
          celebraciones={celebraciones}
        />

        <section
          aria-labelledby="dia-seleccionado"
          className="mt-8 border-t border-borde pt-6"
        >
          <p className="text-sm text-texto-tenue">{fechaLarga(seleccionado)}</p>

          {misaDelDia ? (
            <>
              <h2
                id="dia-seleccionado"
                className="titulo-libro mt-1 text-xl leading-tight text-balance"
              >
                {celebracion}
              </h2>
              {celebracion !== misaDelDia.nombre && (
                <p className="mt-1 text-sm text-texto-tenue">{misaDelDia.nombre}</p>
              )}

              {/* Si ese día tiene más de una misa, no se esconde la otra: la
                  lista vieja las mostraba todas y el calendario no debe perder
                  esa información. */}
              {misasDelDia.length > 1 && (
                <p className="mt-2 text-sm text-texto-tenue">
                  También ese día:{' '}
                  {misasDelDia.slice(1).map((otra, i) => (
                    <span key={otra.id}>
                      {i > 0 && ' · '}
                      <Link
                        href={`/misas/${otra.id}`}
                        className="underline underline-offset-2"
                      >
                        {otra.nombre}
                      </Link>
                    </span>
                  ))}
                </p>
              )}

              <div className="mt-5">
                <TituloSeccion>Lecturas</TituloSeccion>
                {lecturas.length === 0 ? (
                  <p className="mt-1 max-w-prose text-sm text-texto-tenue">
                    Sin lecturas cargadas todavía
                  </p>
                ) : (
                  <ul className="mt-1 space-y-1 text-sm">
                    {lecturas.map((lectura, i) => (
                      <li key={`${lectura.tipo}-${i}`} className="flex flex-wrap gap-x-2">
                        <span className="text-texto-tenue">
                          {NOMBRE_DE_PARTE[lectura.tipo]}
                        </span>
                        <span>{lectura.referencia || 'Sin referencia'}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-5">
                <TituloSeccion>
                  {propuestas.length === 1 ? 'Propuesta' : 'Propuestas'}
                </TituloSeccion>
                {propuestas.length === 0 ? (
                  <p className="mt-1 max-w-prose text-sm text-texto-tenue">
                    Nadie propuso canciones para esta misa
                  </p>
                ) : (
                  <ul className="mt-1 divide-y divide-borde border-t border-borde">
                    {propuestas.map((fila) => (
                      <li key={`${fila.cantoId}·${fila.momentoId}`} className="py-2.5">
                        <p className="text-base">
                          {fila.titulo}{' '}
                          <span className="text-sm text-texto-tenue">
                            · {fila.momentoNombre}
                          </span>
                        </p>
                        {fila.notas.length > 0 && (
                          <ul className="mt-1 space-y-0.5">
                            {fila.notas.map((nota, i) => (
                              <li key={i} className="text-sm text-texto-tenue">
                                «{nota.texto}»
                                {nota.nombre ? ` — ${nota.nombre}` : ''}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <EnlaceIcono
                href={`/misas/${misaDelDia.id}`}
                etiqueta="Abrir la misa"
                texto="Abrir la misa"
                apariencia="lleno"
                className="mt-5 pr-4"
              >
                <IconoSeguir tamano={18} />
              </EnlaceIcono>
            </>
          ) : (
            <>
              <h2
                id="dia-seleccionado"
                className="titulo-libro mt-1 text-xl leading-tight"
              >
                Este día no tiene misa armada
              </h2>
              {puedeEditar && (
                <EnlaceIcono
                  href="/misas/nueva"
                  etiqueta="Armar misa"
                  texto="Armar misa"
                  apariencia="borde"
                  className="mt-4 pr-4"
                >
                  <IconoAgregar tamano={18} />
                </EnlaceIcono>
              )}
            </>
          )}
        </section>
      </main>
    </>
  )
}
