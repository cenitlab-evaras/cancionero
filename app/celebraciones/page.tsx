import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { celebracionesDelCoro } from '@/lib/datos/celebraciones'
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

export default async function CelebracionesPage() {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  const puedeEditar = puede(sesion.sujeto, 'editar_celebracion')

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

  const celebraciones = await celebracionesDelCoro(sesion.coroActivo.id)

  return (
    <>
      <Cabecera sesion={sesion} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-10">
        <div className="flex items-baseline justify-between gap-3 pt-4">
          <h1 className="text-lg font-semibold">Misas</h1>
          {puedeEditar && (
            <Link
              href="/celebraciones/nueva"
              className="tactil flex items-center rounded-lg px-3 text-sm text-acento"
            >
              Nueva
            </Link>
          )}
        </div>

        {celebraciones.length === 0 ? (
          // Vacío legítimo, con su motivo: no es falta de acceso (PRD §14).
          <p className="mt-6 max-w-prose text-sm text-texto-tenue">
            Este coro todavía no tiene celebraciones armadas.
            {puedeEditar
              ? ' Crea una y asígnale un canto por momento.'
              : ' Cuando tu director arme una, aparece acá.'}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-borde border-t border-borde">
            {celebraciones.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/celebraciones/${c.id}`}
                  className="flex min-h-14 items-center justify-between gap-3 py-2 transition-colors hover:bg-superficie"
                >
                  <span className="min-w-0">
                    <span className="block truncate">{c.nombre}</span>
                    <span className="block text-xs text-texto-tenue">
                      {c.fecha ? comoFecha(c.fecha) : 'sin fecha'} ·{' '}
                      {c.cantidadCantos === 1 ? '1 canto' : `${c.cantidadCantos} cantos`}
                    </span>
                  </span>
                  <span className="shrink-0 text-texto-tenue">→</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  )
}
