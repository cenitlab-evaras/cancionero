import Anotados from '@/app/componentes/anotados'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { misasDelCoro } from '@/lib/datos/misas'
import { hoyISO } from '@/lib/datos/historial'
import { agruparMisas } from '@/lib/motores/agenda'
import { cuantoFalta, fechaLarga } from '@/lib/motores/fecha'
import Cabecera from '@/app/componentes/cabecera'
import TituloSeccion from '@/app/componentes/titulo-seccion'
import { EnlaceIcono } from '@/app/componentes/boton-icono'
import { IconoAgregar } from '@/app/componentes/iconos'

export const metadata = { title: 'Misas · Cantoral' }

export default async function MisasPage() {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  const puedeEditar = puede(sesion.sujeto, 'editar_misa')

  if (!sesion.coroActivo) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-10">
          <h1 className="titulo-libro text-[1.75rem] leading-tight">Misas</h1>
          <p className="mt-2 text-sm text-texto-tenue">
            Todavía no perteneces a ningún coro. Pídele a tu director que te agregue.
          </p>
        </main>
      </>
    )
  }

  const misas = await misasDelCoro(sesion.coroActivo.id)
  const hoy = hoyISO()
  const grupos = agruparMisas(misas, hoy)

  return (
    <>
      <Cabecera sesion={sesion} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-10">
        <div className="flex items-center justify-between gap-3">
          <h1 className="titulo-libro text-[1.75rem] leading-tight">Misas</h1>
          {puedeEditar && (
            <EnlaceIcono
              href="/misas/nueva"
              etiqueta="Nueva misa"
              texto="Nueva misa"
              apariencia="lleno"
              className="pr-4"
            >
              <IconoAgregar tamano={18} />
            </EnlaceIcono>
          )}
        </div>

        {misas.length === 0 ? (
          // Vacío legítimo, con su motivo: no es falta de acceso (PRD §14).
          <p className="mt-6 max-w-prose text-sm text-texto-tenue">
            Este coro todavía no tiene misas armadas.
            {puedeEditar
              ? ' Crea una y asígnale un canto por momento.'
              : ' Cuando tu director arme una, aparece acá.'}
          </p>
        ) : (
          <>
            {/* Lo que viene arriba y lo más próximo primero: la pregunta del
                domingo es «cuál es la que sigue», y antes había que leer todas
                las fechas para contestarla. Los grupos se callan si están
                vacíos — un «Ya cantadas (0)» no informa nada. */}
            {grupos.proximas.length > 0 && (
              <Seccion titulo="Lo que viene" misas={grupos.proximas} hoy={hoy} />
            )}
            {grupos.pasadas.length > 0 && (
              <Seccion titulo="Ya cantadas" misas={grupos.pasadas} />
            )}
            {grupos.sinFecha.length > 0 && (
              <Seccion titulo="Sin fecha" misas={grupos.sinFecha} />
            )}
          </>
        )}
      </main>
    </>
  )
}

/**
 * Un grupo de misas con su encabezado.
 *
 * Sin la flecha «→» que había en cada fila: la fila entera ya es un enlace, y
 * seis repeticiones del mismo signo no informaban nada. El espacio se lo lleva
 * el nombre de la misa, que es lo que se lee.
 *
 * Rediseño 2026-10-17: el nombre y, debajo, la fecha en palabras («domingo 18
 * de octubre», con `fechaLarga`, que la lee en UTC y no la corre un día). Los
 * cantos y los anotados se fueron a la derecha, en tenue: antes iban los tres
 * datos en una sola línea de 12 px separada por puntos medios. Con `hoy`, la
 * primera misa de la sección lleva «Hoy / Mañana / En N días» en el halo —la
 * pregunta del domingo es «cuál sigue», y ahí está la respuesta—.
 */
function Seccion({
  titulo,
  misas,
  hoy,
}: {
  titulo: string
  misas: Awaited<ReturnType<typeof misasDelCoro>>
  hoy?: string
}) {
  return (
    <section className="mt-8">
      <TituloSeccion>{titulo}</TituloSeccion>
      <ul className="mt-2 divide-y divide-borde border-t border-borde">
        {misas.map((c, i) => {
          const falta = hoy && i === 0 && c.fecha ? cuantoFalta(c.fecha, hoy) : null
          return (
            <li key={c.id}>
              <Link
                href={`/misas/${c.id}`}
                className="-mx-2 flex min-h-14 items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-superficie"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base">{c.nombre}</span>
                  {/* Sin fecha no se repite «Sin fecha»: ya lo dice la sección. */}
                  {c.fecha && (
                    <span className="block text-sm text-texto-tenue">
                      {falta && <span className="font-semibold text-acento">{falta} · </span>}
                      {fechaLarga(c.fecha)}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-right text-sm text-texto-tenue">
                  <span className="block">
                    {c.cantidadCantos === 1 ? '1 canto' : `${c.cantidadCantos} cantos`}
                  </span>
                  {/* H15 · solo si hay alguien: «0 anotados» en cada fila sería
                      un reproche semanal, no un dato. Desde el 2026-10-17, sus
                      iniciales con el color de su cuerda, además del número. */}
                  {c.anotados > 0 && (
                    <span className="mt-1 flex items-center justify-end gap-2">
                      <Anotados quienes={c.quienes} />
                      <span aria-hidden>{c.anotados}</span>
                    </span>
                  )}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
