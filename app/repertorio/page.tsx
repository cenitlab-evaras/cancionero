import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { repertorioPorMomento } from '@/lib/datos/repertorio'
import { cantosConPartitura } from '@/lib/datos/partitura'
import { contarEnEnsayo, etiquetaEstado } from '@/lib/motores/estado-canto'
import Cabecera from '@/app/componentes/cabecera'
import TituloSeccion from '@/app/componentes/titulo-seccion'
import { EnlaceIcono, clasesBotonIcono } from '@/app/componentes/boton-icono'
import { IconoAgregar } from '@/app/componentes/iconos'
import Buscador from './buscador'

export const metadata = { title: 'Repertorio · Cantoral' }

/**
 * El repertorio del coro, ordenado como el cancionero (rediseño 2026-10-17).
 *
 * Es destino de primer nivel —se llega por la barra de abajo—, así que no
 * lleva flecha de volver. Y es SOLO el repertorio: Historial, Sugerencias y
 * los archivados, que antes colgaban del pie de esta lista de 4 700 px, ahora
 * viven en «Más», donde se encuentran sin tener que recorrerla entera.
 */

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
        <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-10">
          <h1 className="titulo-libro text-[1.75rem] leading-tight">
            Todavía no perteneces a ningún coro
          </h1>
          <p className="mt-2 max-w-prose text-texto-tenue">
            {sesion.sujeto.rol === 'admin'
              ? 'Como administrador puedes ver los coros de la instalación, pero para leer un repertorio tienes que ser miembro de uno. Puedes asignarte desde la pantalla de miembros del coro.'
              : 'Pídele a tu director que te agregue. Cuando lo haga, acá vas a ver su repertorio.'}
          </p>
        </main>
      </>
    )
  }

  const { q = '' } = await searchParams
  const puedeEditar = puede(sesion.sujeto, 'editar_canto')
  const [grupos, conPartitura] = await Promise.all([
    repertorioPorMomento(sesion.coroActivo.id, q),
    // H23 · qué cantos se pueden ensayar: sin esto, «Ensayar» solo se
    // descubría entrando canto por canto.
    puede(sesion.sujeto, 'ensayar_canto') ? cantosConPartitura() : Promise.resolve(new Set<string>()),
  ])
  const total = grupos.reduce((n, g) => n + g.cantos.length, 0)
  // Se calcula al leer, nunca se guarda (innegociable 4). El motor cuenta por
  // id: un canto asignado a tres momentos aparece tres veces en `grupos`.
  const enEnsayo = contarEnEnsayo(grupos.flatMap((g) => g.cantos))

  return (
    <>
      {/* Sin la barra de búsqueda de la cabecera: acá está la del repertorio. */}
      <Cabecera sesion={sesion} buscador={false} />

      <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-16">
        <h1 className="titulo-libro text-[1.75rem] leading-tight">Repertorio</h1>

        {/* El buscador queda a mano mientras se recorre la lista. Cuelga justo
            bajo la cabecera, que mide 56 px (`top-14`). El fondo es opaco y
            sin `backdrop-blur`: con el 95 % de antes las filas se veían pasar
            en fantasma por detrás. */}
        <div className="sticky top-14 z-(--z-barra) -mx-4 mt-3 flex items-center gap-2 bg-fondo px-4 py-3">
          <div className="min-w-0 flex-1">
            <Buscador valorInicial={q} />
          </div>
          {/* Con texto visible: un «+» solo no dice qué agrega. */}
          {puedeEditar && (
            <EnlaceIcono
              href="/repertorio/nuevo"
              etiqueta="Cargar un canto nuevo"
              apariencia="borde"
              texto="Nuevo"
            >
              <IconoAgregar tamano={18} />
            </EnlaceIcono>
          )}
        </div>

        {total === 0 && q !== '' && (
          <div className="py-10">
            <p className="text-texto-tenue">Ningún canto coincide con «{q}».</p>
            <Link href="/repertorio" className={clasesBotonIcono('borde', 'mt-4 px-4')}>
              Limpiar la búsqueda
            </Link>
          </div>
        )}

        {/* Un estado vacío explica por qué está vacío (PRD §14). */}
        {total === 0 && q === '' && (
          <div className="py-10">
            <p>Este coro todavía no tiene repertorio.</p>
            <p className="mt-2 max-w-prose text-texto-tenue">
              {puedeEditar
                ? 'Como director puedes cargar el primero.'
                : 'Cuando el director cargue cantos, vas a verlos acá.'}
            </p>
            {puedeEditar && (
              <Link href="/repertorio/nuevo" className={clasesBotonIcono('lleno', 'mt-5 px-5')}>
                Cargar el primer canto
              </Link>
            )}
          </div>
        )}

        {/* La estructura es la del cancionero: momentos litúrgicos y cantos
            numerados. No hay tarjetas — las filas continuas dejan que el ojo
            recorra la lista sin tropezar con un marco por canto. */}
        {grupos.map((grupo) => (
          <section key={grupo.codigo} className="pt-6">
            {/* El título de sección único de la app (sin mayúsculas espaciadas,
                que a 13 px y en tenue se leían lento). Sin contador: al lado de
                los números de canto se lee como uno más, y la cuenta total ya
                está al pie. */}
            <TituloSeccion>{grupo.nombre}</TituloSeccion>

            <ul className="mt-1">
              {grupo.cantos.map((canto) => {
                // H10 · La marca solo aparece cuando dice algo: `listo` es el
                // caso normal y etiquetar cada fila no informaría nada.
                const marca = etiquetaEstado(canto.estado)
                const partitura = conPartitura.has(canto.id)
                return (
                  <li key={canto.id} className="border-b border-borde last:border-b-0">
                    <Link
                      href={`/repertorio/${canto.id}`}
                      className="tactil group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-superficie"
                    >
                      {/* El número del cancionero, en los números de estilo
                          antiguo del libro: no es un dato técnico, así que no
                          va en la monoespaciada del cifrado. Sin número, el
                          hueco queda vacío y la columna no se corre. */}
                      <span
                        className="numero-libro w-7 shrink-0 text-right text-texto-tenue"
                        aria-hidden
                      >
                        {canto.fuenteNumero ?? ''}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{canto.titulo}</span>
                        {/* El canto NO cambia de grupo ni de lugar: la marca va
                            en la línea secundaria, donde ya vive el autor, para
                            que la lista se siga leyendo de un tirón. */}
                        {(marca || partitura || canto.autor) && (
                          <span className="flex min-w-0 items-center gap-2">
                            {marca && (
                              <span className="shrink-0 rounded border border-borde-fuerte px-1.5 text-xs font-bold text-texto">
                                {marca}
                              </span>
                            )}
                            {/* H23 · se puede ensayar: tiene partitura con sus pistas. */}
                            {partitura && (
                              <span className="shrink-0 rounded border border-borde-fuerte px-1.5 text-xs font-bold text-texto">
                                Partitura
                              </span>
                            )}
                            {canto.autor && (
                              <span className="truncate text-sm text-texto-tenue">{canto.autor}</span>
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

        {/* Solo la cuenta. Los enlaces a historial, sugerencias y archivados
            que vivían en este pie se mudaron a «Más» (2026-10-17): al final de
            una lista de 86 cantos no los encontraba nadie, y en «Más» cada uno
            tiene su fila de 44 px. Queda el resumen de H10, que no es un
            enlace sino parte de la cuenta; la de ensayo es de cantos
            distintos, no de filas, porque el listado repite un canto en cada
            momento. */}
        {total > 0 && (
          <p className="pt-8 text-sm text-texto-tenue">
            {total} {total === 1 ? 'canto' : 'cantos'} en {sesion.coroActivo.nombre}
            {enEnsayo > 0 && `, ${enEnsayo} en ensayo`}
          </p>
        )}
      </main>
    </>
  )
}
