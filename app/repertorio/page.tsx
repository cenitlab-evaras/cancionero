import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { repertorioPorMomento } from '@/lib/datos/repertorio'
import { cantosConPartitura } from '@/lib/datos/partitura'
import { contarEnEnsayo, etiquetaEstado } from '@/lib/motores/estado-canto'
import Cabecera from '@/app/componentes/cabecera'
import TituloSeccion from '@/app/componentes/titulo-seccion'
import { clasesBotonIcono } from '@/app/componentes/boton-icono'
import { repetidas } from '@/lib/motores/catalogo'
import Buscador from './buscador'
import FilaCanto, { type DatosFila } from './fila-canto'
import RepertorioOrdenable from './repertorio-ordenable'

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
  // El director ordena arrastrando (2026-10-17). Con una búsqueda escrita no:
  // se moverían cantos respecto de otros que no se ven.
  const ordenable = puedeEditar && !q
  const [grupos, conPartitura] = await Promise.all([
    repertorioPorMomento(sesion.coroActivo.id, q),
    // H23 · qué cantos se pueden ensayar: sin esto, «Ensayar» solo se
    // descubría entrando canto por canto.
    puede(sesion.sujeto, 'ensayar_canto')
      ? cantosConPartitura()
      : Promise.resolve(new Map<string, { solistas: boolean }>()),
  ])
  // Canciones distintas, no filas: una canción en tres momentos sale tres
  // veces en la lista y antes se contaba tres veces (2026-10-17).
  const distintos = [...new Map(grupos.flatMap((g) => g.cantos).map((c) => [c.id, c])).values()]
  const total = distintos.length
  // La misma canción cargada dos veces (de dos cancioneros): se marca.
  const veces = repetidas(distintos)
  // Se calcula al leer, nunca se guarda (innegociable 4). El motor cuenta por
  // id: un canto asignado a tres momentos aparece tres veces en `grupos`.
  const enEnsayo = contarEnEnsayo(grupos.flatMap((g) => g.cantos))
  // Lo que dibuja cada fila, una vez por canción: la misma la usan la lista
  // quieta del miembro y la que arrastra el director.
  const filas: Record<string, DatosFila> = Object.fromEntries(
    distintos.map((c) => [
      c.id,
      {
        id: c.id,
        titulo: c.titulo,
        // H10 · La marca solo aparece cuando dice algo: `listo` es el caso
        // normal y etiquetar cada fila no informaría nada.
        enEnsayo: Boolean(etiquetaEstado(c.estado)),
        repetida: veces.get(c.id) ?? null,
        partitura: conPartitura.get(c.id) ?? null,
        tonalidad: c.tonalidadOriginal,
      },
    ])
  )
  const momentos = grupos.map((g) => ({ codigo: g.codigo, nombre: g.nombre, cantos: g.cantos.map((c) => c.id) }))

  return (
    <>
      {/* Sin «Buscar un canto» de la cabecera: acá está la lupa del repertorio. */}
      <Cabecera sesion={sesion} buscador={false} />

      <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-16">
        {/* El título con su lupa queda a mano mientras se recorre la lista.
            Cuelga justo bajo la cabecera, que mide 56 px (`top-14`). El fondo
            es opaco y sin `backdrop-blur`: con el 95 % de antes las filas se
            veían pasar en fantasma por detrás. «Nuevo» ya no va acá: cargar
            un canto se hace desde Herramientas (el dueño, 2026-10-17). */}
        <div className="sticky top-14 z-(--z-barra) -mx-4 -mt-3 bg-fondo px-4 py-3">
          <Buscador valorInicial={q} />
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
        {ordenable ? (
          <RepertorioOrdenable momentos={momentos} filas={filas} />
        ) : (
          momentos.map((m) => (
            <section key={m.codigo} className="pt-6">
              {/* El título de sección único de la app (sin mayúsculas
                  espaciadas, que a 13 px y en tenue se leían lento). Sin
                  contador: al lado de los números de canto se lee como uno más,
                  y la cuenta total ya está al pie. */}
              <TituloSeccion>{m.nombre}</TituloSeccion>
              <ul className="mt-1">
                {m.cantos.map((id) => (
                  <FilaCanto key={id} canto={filas[id]} />
                ))}
              </ul>
            </section>
          ))
        )}

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
