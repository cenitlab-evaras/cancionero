import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { repertorioPorMomento } from '@/lib/datos/repertorio'
import { cantosConPartitura } from '@/lib/datos/partitura'
import { repertorioConHistorial } from '@/lib/datos/historial'
import { contarEnEnsayo, etiquetaEstado } from '@/lib/motores/estado-canto'
import Cabecera from '@/app/componentes/cabecera'
import TituloSeccion from '@/app/componentes/titulo-seccion'
import { clasesBotonIcono } from '@/app/componentes/boton-icono'
import { claveDeTitulo, repetidas } from '@/lib/motores/catalogo'
import Buscador from './buscador'
import Atajos from './atajos'
import FilaCanto, { type DatosFila } from './fila-canto'
import { ProveedorSeleccion } from './seleccion'
import GestosDeLista from './gestos-lista'
import VistaTodas from './vista-todas'

export const metadata = { title: 'Canciones · Cantoral' }

/**
 * El repertorio del coro, ordenado como el cancionero (rediseño 2026-10-17), y
 * desde el 2026-11-19 la ÚNICA pantalla de Canciones: acá viven las dos vistas
 * con el conmutador «Por momento / Todas».
 *
 * Es destino de primer nivel —se llega por la barra de abajo—, así que no
 * lleva flecha de volver. Y es SOLO el repertorio: Historial, Sugerencias y
 * los archivados, que antes colgaban del pie de esta lista de 4 700 px, ahora
 * viven en «Más», donde se encuentran sin tener que recorrerla entera.
 */

/** El destino de cada lado del conmutador, conservando la búsqueda. */
function hrefDeVista(vista: 'todas' | null, q: string) {
  const p = new URLSearchParams()
  if (vista === 'todas') p.set('vista', 'todas')
  if (q) p.set('q', q)
  const qs = p.toString()
  return qs ? `/repertorio?${qs}` : '/repertorio'
}

/** «Por momento / Todas»: dos pestañas de texto, 44 px, que conservan `q`. */
function ConmutadorVista({ vista, q }: { vista: 'todas' | undefined; q: string }) {
  const activo = 'border-acento font-bold text-texto'
  const inactivo = 'border-transparent text-texto-tenue hover:text-texto'
  return (
    <nav aria-label="Cómo ver las canciones" className="flex items-center gap-4">
      <Link
        href={hrefDeVista(null, q)}
        aria-current={vista !== 'todas' ? 'page' : undefined}
        className={`tactil inline-flex min-h-11 items-center border-b-2 text-sm transition-colors ${
          vista !== 'todas' ? activo : inactivo
        }`}
      >
        Por momento
      </Link>
      <Link
        href={hrefDeVista('todas', q)}
        aria-current={vista === 'todas' ? 'page' : undefined}
        className={`tactil inline-flex min-h-11 items-center border-b-2 text-sm transition-colors ${
          vista === 'todas' ? activo : inactivo
        }`}
      >
        Todas
      </Link>
    </nav>
  )
}

export default async function RepertorioPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    vista?: string
    momento?: string
    estado?: string
    partitura?: string
    repetidas?: string
    solistas?: string
    pagina?: string
    seleccion?: string
  }>
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
          <h1 className="titulo-pantalla leading-tight">
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

  const sp = await searchParams
  const q = sp.q ?? ''
  const vista = sp.vista === 'todas' ? 'todas' : undefined

  const puedeEditar = puede(sesion.sujeto, 'editar_canto')
  // El modo de selección múltiple vive en la URL: así las casillas —y su isla
  // de cliente por fila— solo existen cuando se piden (2026-11-20).
  const modoSeleccion = vista !== 'todas' && puedeEditar && sp.seleccion === '1'
  function hrefConSeleccion(activa: boolean) {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(sp)) {
      if (v && k !== 'seleccion') p.set(k, v)
    }
    if (activa) p.set('seleccion', '1')
    const qs = p.toString()
    return qs ? `/repertorio?${qs}` : '/repertorio'
  }
  // Los gestos de la fila (2026-11-20): solo el director. Cada acción vuelve a
  // comprobar su capacidad en el servidor y la RLS decide al escribir.
  const gestosDeFila = puedeEditar
    ? {
        proximaMisa: puede(sesion.sujeto, 'asignar_cantos_misa'),
        ensayo: true,
        archivar: puede(sesion.sujeto, 'archivar_canto'),
      }
    : undefined
  let grupos: Awaited<ReturnType<typeof repertorioPorMomento>> = []
  let conPartitura: Map<string, { solistas: boolean }> = new Map()
  let conHistorial: Awaited<ReturnType<typeof repertorioConHistorial>> = []
  if (vista !== 'todas') {
    ;[grupos, conPartitura, conHistorial] = await Promise.all([
      repertorioPorMomento(sesion.coroActivo.id, q),
      // H23 · qué cantos se pueden ensayar: sin esto, «Ensayar» solo se
      // descubría entrando canto por canto.
      puede(sesion.sujeto, 'ensayar_canto')
        ? cantosConPartitura()
        : Promise.resolve(new Map<string, { solistas: boolean }>()),
      // La regleta del dueño (2026-11-20): cuántas veces se cantó cada uno.
      repertorioConHistorial(sesion.coroActivo.id),
    ])
    // Alfabético, sin arrastre (el dueño, 2026-11-20): el orden que dejó el
    // director deja de mandar en la lista. Se compara sin tildes ni mayúsculas.
    grupos = grupos.map((g) => ({
      ...g,
      cantos: [...g.cantos].sort((a, b) =>
        claveDeTitulo(a.titulo).localeCompare(claveDeTitulo(b.titulo))
      ),
    }))
  }
  // Cantos distintos, no filas: una canción en tres momentos sale tres
  // veces en la lista y antes se contaba tres veces (2026-10-17).
  const distintos = [...new Map(grupos.flatMap((g) => g.cantos).map((c) => [c.id, c])).values()]
  const total = distintos.length
  // La misma canción cargada dos veces (de dos cancioneros): se marca.
  const veces = repetidas(distintos)
  // Se calcula al leer, nunca se guarda (innegociable 4). El motor cuenta por
  // id: un canto asignado a tres momentos aparece tres veces en `grupos`.
  const enEnsayo = contarEnEnsayo(grupos.flatMap((g) => g.cantos))
  // La intensidad se mide contra la más cantada del coro, no del momento: la
  // regleta responde «cuánto suena esto respecto de todo lo demás».
  const cantadas = new Map(conHistorial.map((c) => [c.id, c.historial.veces]))
  const maxCantadas = Math.max(1, ...cantadas.values())
  // Lo que dibuja cada fila, una vez por canción.
  const filas: Record<string, DatosFila> = Object.fromEntries(
    distintos.map((c) => {
      const cantada = cantadas.get(c.id) ?? 0
      return [
        c.id,
        {
          id: c.id,
          titulo: c.titulo,
          // H10 · La marca solo aparece cuando dice algo: `listo` es el caso
          // normal y etiquetar cada fila no informaría nada.
          enEnsayo: Boolean(etiquetaEstado(c.estado)),
          repetida: veces.get(c.id) ?? null,
          partitura: conPartitura.get(c.id) ?? null,
          veces: cantada,
          intensidad: Math.round((100 * cantada) / maxCantadas),
          autor: c.autor,
        },
      ] as const
    })
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
            un canto se hace desde Herramientas (el dueño, 2026-10-17).
            Desde el 2026-11-19 el bloque suma el conmutador y los chips. */}
        {/* La `key` remonta el proveedor al entrar o salir del modo: la
            selección no sobrevive a un cambio de modo ni de vista. */}
        <ProveedorSeleccion key={modoSeleccion ? 'seleccion' : 'normal'} habilitado={modoSeleccion}>
        <div className="sticky top-14 z-(--z-barra) -mx-4 -mt-3 bg-fondo px-4 py-2">
          <Buscador valorInicial={q} vista={vista} filtros={sp} />
          <div className="mt-1 flex items-center gap-4">
            <ConmutadorVista vista={vista} q={q} />
            {vista !== 'todas' && puedeEditar && (
              <Link
                href={hrefConSeleccion(!modoSeleccion)}
                className={`tactil ml-auto inline-flex min-h-11 items-center text-sm underline underline-offset-2 ${
                  modoSeleccion ? 'font-bold text-acento' : 'text-texto-tenue hover:text-texto'
                }`}
              >
                {modoSeleccion ? 'Cancelar' : 'Seleccionar'}
              </Link>
            )}
          </div>
          {vista !== 'todas' && <Atajos momentos={momentos} className="mt-1 min-w-0" />}
        </div>

        {vista === 'todas' ? (
          <VistaTodas sesion={sesion} parametros={sp} />
        ) : (
          <>
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
                <p>Este coro todavía no tiene canciones.</p>
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
                en orden alfabético (2026-11-20: se fue el arrastre). Sin
                tarjetas — las filas continuas dejan que el ojo recorra la lista
                sin tropezar con un marco por canto.
                El `id` y el `scroll-mt` son el destino de los chips: el título
                aterriza bajo el bloque pegajoso (cabecera 56 px + buscador +
                conmutador + chips), no escondido detrás. */}
            <GestosDeLista>
            {momentos.map((m) => (
              <section
                key={m.codigo}
                id={`momento-${m.codigo}`}
                className="scroll-mt-64 pt-6"
              >
                {/* El título de sección único de la app (sin mayúsculas
                    espaciadas, que a 13 px y en tenue se leían lento). Sin
                    contador: al lado de los números de canto se lee como uno más,
                    y la cuenta total ya está al pie. */}
                <TituloSeccion>{m.nombre}</TituloSeccion>
                <ul className="mt-1">
                  {m.cantos.map((id) => (
                    <FilaCanto
                      key={id}
                      canto={filas[id]}
                      gestos={gestosDeFila}
                      seleccionable={modoSeleccion}
                    />
                  ))}
                </ul>
              </section>
            ))}
            </GestosDeLista>

            {/* Solo la cuenta. Los enlaces a historial, sugerencias y archivados
                que vivían en este pie se mudaron a «Más» (2026-10-17): al final de
                una lista de 86 cantos no los encontraba nadie, y en «Más» cada uno
                tiene su fila de 44 px. Queda el resumen de H10, que no es un
                enlace sino parte de la cuenta; la de ensayo es de cantos
                distintos, no de filas, porque el listado repite un canto en cada
                momento. */}
            {total > 0 && (
              <p className="pt-8 text-sm text-texto-tenue text-balance">
                {total} {total === 1 ? 'canto' : 'cantos'} en {sesion.coroActivo.nombre}
                {enEnsayo > 0 && `, ${enEnsayo} en ensayo`}
              </p>
            )}
          </>
        )}
        </ProveedorSeleccion>
      </main>
    </>
  )
}
