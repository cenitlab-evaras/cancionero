import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { misasDelCoro } from '@/lib/datos/misas'
import { hoyISO } from '@/lib/datos/historial'
import { agruparMisas } from '@/lib/motores/agenda'
import Cabecera from '@/app/componentes/cabecera'

export const metadata = { title: 'Misas · Cantoral' }

/** El domingo 3 de agosto, no "2026-08-03": la misa se nombra por su día. */
function comoFecha(iso: string) {
  const [a, m, d] = iso.split('-').map(Number)
  return new Date(a, m - 1, d).toLocaleDateString('es-CL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export default async function MisasPage() {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  const puedeEditar = puede(sesion.sujeto, 'editar_misa')

  if (!sesion.coroActivo) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <h1 className="text-lg font-semibold">Misas</h1>
          <p className="mt-2 text-sm text-texto-tenue">
            Todavía no perteneces a ningún coro. Pídele a tu director que te agregue.
          </p>
        </main>
      </>
    )
  }

  const misas = await misasDelCoro(sesion.coroActivo.id)
  const grupos = agruparMisas(misas, hoyISO())

  return (
    <>
      <Cabecera sesion={sesion} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-10">
        <div className="flex items-baseline justify-between gap-3 pt-4">
          <h1 className="text-lg font-semibold">Misas</h1>
          {puedeEditar && (
            <Link
              href="/misas/nueva"
              className="tactil flex items-center rounded-lg px-3 text-sm text-acento"
            >
              Nueva
            </Link>
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
              <Seccion titulo="Lo que viene" misas={grupos.proximas} />
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
 */
function Seccion({
  titulo,
  misas,
}: {
  titulo: string
  misas: Awaited<ReturnType<typeof misasDelCoro>>
}) {
  return (
    <section className="mt-6">
      <h2 className="text-[0.8125rem] font-semibold text-texto-tenue uppercase">{titulo}</h2>
      <ul className="mt-2 divide-y divide-borde border-t border-borde">
        {misas.map((c) => (
          <li key={c.id}>
            <Link
              href={`/misas/${c.id}`}
              className="-mx-2 flex min-h-14 items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-superficie"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{c.nombre}</span>
                <span className="block text-xs text-texto-tenue">
                  {c.fecha ? comoFecha(c.fecha) : 'sin fecha'} ·{' '}
                  {c.cantidadCantos === 1 ? '1 canto' : `${c.cantidadCantos} cantos`}
                  {/* H15 · solo si hay alguien: «0 anotados» en cada fila sería
                      un reproche semanal, no un dato. */}
                  {c.anotados > 0 &&
                    ` · ${c.anotados} ${c.anotados === 1 ? 'anotado' : 'anotados'}`}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
