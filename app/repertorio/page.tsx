import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { contarArchivados, repertorioPorMomento } from '@/lib/datos/repertorio'
import { contarEnEnsayo, etiquetaEstado } from '@/lib/motores/estado-canto'
import Cabecera from '@/app/componentes/cabecera'
import Buscador from './buscador'

export const metadata = { title: 'Repertorio · Cantoral' }

export default async function RepertorioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  // Vacío legítimo, NO falta de acceso: el usuario está aprobado pero todavía
  // no lo agregaron a ningún coro (PRD §14).
  if (!sesion.coroActivo) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <h1 className="text-lg font-semibold">Todavía no perteneces a ningún coro</h1>
          <p className="mt-2 max-w-prose text-sm text-texto-tenue">
            {sesion.sujeto.rol === 'admin'
              ? 'Como administrador puedes ver los coros de la instalación, pero para leer un repertorio tienes que ser miembro de uno. Puedes asignarte desde la pantalla de miembros del coro.'
              : 'Pídele a tu director que te agregue. Cuando lo haga, acá vas a ver su repertorio.'}
          </p>
        </main>
      </>
    )
  }

  const { q = '' } = await searchParams
  const puedeArchivar = puede(sesion.sujeto, 'archivar_canto')
  const [grupos, archivados] = await Promise.all([
    repertorioPorMomento(sesion.coroActivo.id, q),
    // Solo se pregunta si hay a quién ofrecerle el enlace.
    puedeArchivar ? contarArchivados(sesion.coroActivo.id) : Promise.resolve(0),
  ])
  const total = grupos.reduce((n, g) => n + g.cantos.length, 0)
  // Se calcula al leer, nunca se guarda (innegociable 4). El motor cuenta por
  // id: un canto asignado a tres momentos aparece tres veces en `grupos`.
  const enEnsayo = contarEnEnsayo(grupos.flatMap((g) => g.cantos))

  return (
    <>
      <Cabecera sesion={sesion} />

      <main className="mx-auto w-full max-w-2xl px-4 pb-16">
        <div className="sticky top-14 z-(--z-barra) -mx-4 flex items-center gap-2 bg-fondo/95 px-4 pt-3 pb-3 backdrop-blur">
          <div className="min-w-0 flex-1">
            <Buscador valorInicial={q} />
          </div>
          {puede(sesion.sujeto, 'editar_canto') && (
            <Link
              href="/repertorio/nuevo"
              aria-label="Cargar un canto nuevo"
              className="tactil flex w-11 shrink-0 items-center justify-center rounded-lg border border-borde-fuerte text-lg text-acento"
            >
              +
            </Link>
          )}
        </div>

        {total === 0 && q !== '' && (
          <p className="py-10 text-sm text-texto-tenue">
            Ningún canto coincide con «{q}».{' '}
            <Link href="/repertorio" className="text-acento underline underline-offset-2">
              Limpiar búsqueda
            </Link>
          </p>
        )}

        {total === 0 && q === '' && (
          <div className="py-10">
            <p className="text-sm">Este coro todavía no tiene repertorio.</p>
            <p className="mt-2 max-w-prose text-sm text-texto-tenue">
              {puede(sesion.sujeto, 'editar_canto') ? (
                <>
                  Como director puedes{' '}
                  <Link href="/repertorio/nuevo" className="text-acento underline underline-offset-2">
                    cargar el primero
                  </Link>
                  .
                </>
              ) : (
                'Cuando el director cargue cantos, vas a verlos acá.'
              )}
            </p>
          </div>
        )}

        {/* La estructura es la del cancionero: momentos litúrgicos y cantos
            numerados. No hay tarjetas — las filas continuas dejan que el ojo
            recorra la lista sin tropezar con un marco por canto. */}
        {grupos.map((grupo) => (
          <section key={grupo.codigo} className="pt-7 first:pt-4">
            {/* Sin contador por sección: al lado de los números de canto se lee
                como uno más, y la cuenta total ya está al pie. */}
            <h2 className="flex items-center gap-3 text-[0.8125rem] font-semibold tracking-[0.14em] text-texto-tenue uppercase">
              {grupo.nombre}
              <span className="h-px flex-1 bg-borde" aria-hidden />
            </h2>

            <ul className="mt-1">
              {grupo.cantos.map((canto) => {
                // H10 · La marca solo aparece cuando dice algo: `listo` es el
                // caso normal y etiquetar cada fila no informaría nada.
                const marca = etiquetaEstado(canto.estado)
                return (
                  <li key={canto.id} className="border-b border-borde/70 last:border-b-0">
                    <Link
                      href={`/repertorio/${canto.id}`}
                      className="tactil group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-superficie"
                    >
                      <span
                        className="w-7 shrink-0 text-right font-cifrado text-xs text-texto-tenue"
                        aria-hidden
                      >
                        {canto.fuenteNumero ?? '·'}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{canto.titulo}</span>
                        {/* El canto NO cambia de grupo ni de lugar: la marca va
                            en la línea secundaria, donde ya vive el autor, para
                            que la lista se siga leyendo de un tirón. */}
                        {(marca || canto.autor) && (
                          <span className="flex min-w-0 items-center gap-2">
                            {marca && (
                              <span className="shrink-0 rounded border border-borde-fuerte px-1 py-px text-[0.625rem] tracking-[0.08em] text-texto-tenue uppercase">
                                {marca}
                              </span>
                            )}
                            {canto.autor && (
                              <span className="truncate text-xs text-texto-tenue">{canto.autor}</span>
                            )}
                          </span>
                        )}
                      </span>

                      {canto.tonalidadOriginal && (
                        <span className="shrink-0 font-cifrado text-sm text-acorde">
                          {canto.tonalidadOriginal}
                        </span>
                      )}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}

        {total > 0 && (
          <p className="pt-8 text-xs text-texto-tenue">
            {total} {total === 1 ? 'canto' : 'cantos'} en {sesion.coroActivo.nombre}
            {/* El resumen de H10. La cuenta es de cantos distintos, no de filas:
                el listado repite un canto en cada momento que tenga. */}
            {enEnsayo > 0 && ` · ${enEnsayo} en ensayo`}
            {' · '}
            {/* H13 · El acceso al historial vive acá y no en la cabecera: esa
                barra es para moverse MIENTRAS se toca, y a 360 px un director
                ya tiene Misas, Miembros y Salir. El historial se consulta al
                planificar la misa, y se planifica mirando el repertorio. */}
            <Link href="/historial" className="text-acento underline underline-offset-2">
              ver historial
            </Link>
            {/* Los archivados se ofrecen solo a quien puede traerlos de vuelta,
                y solo si hay alguno: un enlace a una papelera vacía es ruido en
                una pantalla que se mira de reojo. */}
            {puedeArchivar && archivados > 0 && (
              <>
                {' · '}
                <Link
                  href="/repertorio/archivados"
                  className="text-acento underline underline-offset-2"
                >
                  {archivados} {archivados === 1 ? 'archivado' : 'archivados'}
                </Link>
              </>
            )}
          </p>
        )}
      </main>
    </>
  )
}
