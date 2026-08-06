import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { obtenerCelebracion } from '@/lib/datos/celebraciones'
import Cabecera from '@/app/componentes/cabecera'

export const metadata = { title: 'Celebración · Cantoral' }

/**
 * La misa, en el orden en que se canta.
 *
 * Es la antesala de la vista de ejecución: desde acá se entra al primer canto y
 * ya no se vuelve — de eso se encarga la navegación de `[filaId]`.
 */
export default async function CelebracionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  const { id } = await params
  const celebracion = await obtenerCelebracion(id)

  // Cero filas por RLS no es un estado vacío: es falta de acceso (PRD §14).
  if (!celebracion) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <h1 className="text-lg font-semibold text-peligro">
            No tienes acceso a esta celebración
          </h1>
          <p className="mt-2 max-w-prose text-sm text-texto-tenue">
            Pertenece a un coro del que no eres parte, o ya no existe.
          </p>
          <Link
            href="/celebraciones"
            className="mt-6 inline-block text-sm text-acento underline underline-offset-2"
          >
            Volver a las celebraciones
          </Link>
        </main>
      </>
    )
  }

  const puedeEditar = puede(sesion.sujeto, 'editar_celebracion')

  return (
    <>
      <Cabecera sesion={sesion} />

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-10">
        <div className="flex items-baseline gap-3 pt-4">
          <Link
            href="/celebraciones"
            className="-ml-1 shrink-0 rounded px-1 text-sm text-texto-tenue transition-colors hover:text-texto"
            aria-label="Volver a las celebraciones"
          >
            ←
          </Link>
          <h1 className="min-w-0 text-[1.375rem] leading-tight font-semibold text-balance">
            {celebracion.nombre}
          </h1>
        </div>

        <div className="mt-1.5 flex items-baseline justify-between gap-3 pl-7">
          <p className="text-xs text-texto-tenue">
            {celebracion.cantos.length === 0
              ? 'sin cantos'
              : celebracion.cantos.length === 1
                ? '1 canto'
                : `${celebracion.cantos.length} cantos`}
          </p>
          {puedeEditar && (
            <Link href={`/celebraciones/${celebracion.id}/editar`} className="text-sm text-acento">
              Armar
            </Link>
          )}
        </div>

        {celebracion.cantos.length === 0 ? (
          <p className="mt-8 max-w-prose text-sm text-texto-tenue">
            Esta celebración todavía no tiene cantos.
            {puedeEditar
              ? ' Toca «Armar» para asignarle uno por momento.'
              : ' Cuando tu director la arme, aparecen acá.'}
          </p>
        ) : (
          <>
            <ol className="mt-4 divide-y divide-borde border-t border-borde">
              {celebracion.cantos.map((c, i) => (
                <li key={c.id}>
                  <Link
                    href={`/celebraciones/${celebracion.id}/${c.id}`}
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
              href={`/celebraciones/${celebracion.id}/${celebracion.cantos[0].id}`}
              className="tactil mt-6 flex items-center justify-center rounded-lg bg-acento font-medium text-white"
            >
              Empezar la misa
            </Link>
          </>
        )}
      </main>
    </>
  )
}
