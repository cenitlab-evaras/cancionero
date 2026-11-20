import Link from 'next/link'
import { puede } from '@/lib/permisos'
import type { SesionCantoral } from '@/lib/sesion'
import { catalogoDelCoro } from '@/lib/datos/repertorio'
import { cantosConPartitura } from '@/lib/datos/partitura'
import { claveDeTitulo, filtrarCatalogo, repetidas } from '@/lib/motores/catalogo'
import { esEstadoValido } from '@/lib/motores/estado-canto'
import {
  MarcaEnsayo,
  MarcaPartitura,
  MarcaRepetida,
  MarcaSolistas,
} from '@/app/componentes/marcas'
import { IconoDesplegar } from '@/app/componentes/iconos'
import Filtros from '@/app/canciones/filtros'

export type ParametrosDeVista = {
  q?: string
  momento?: string
  estado?: string
  partitura?: string
  repetidas?: string
  solistas?: string
  pagina?: string
}

/** Filas por página del catálogo (P2-3): 529 filas de una vez eran ~7 600
 *  nodos. La lista completa sigue viva en «Por momento», donde se ordena. */
const POR_PAGINA = 50

/**
 * «Todas» (pedido del dueño, 2026-10-17; unificada con el repertorio el
 * 2026-11-19): todas las canciones del coro, una vez cada una, para saber
 * cuántas hay. En el repertorio una canción sale en cada momento donde está;
 * acá va una por fila con sus momentos al lado, las que entraron dos veces
 * marcadas como «Repetida», y filtros como en una tabla.
 *
 * La dibuja `app/repertorio/page.tsx` cuando `?vista=todas`, así que NO lleva
 * Cabecera ni `<main>`: el h1 («Todas las canciones») y el buscador compartido
 * viven en el bloque pegajoso de la página, y acá el contenido arranca con la
 * cuenta. Es de solo lectura: el arrastre y el archivar quedan en «Por momento».
 * Se pagina de a 50 (`?pagina=N`): 529 filas en un tirón eran ~7 600 nodos, y
 * esta vista se recorre buscando, no de punta a punta.
 * Desde el 2026-11-20 es una LISTA (no una tabla) con los filtros plegados y
 * sin leyenda de íconos: el dueño la pidió «mucho más simple».
 */
export default async function VistaTodas({
  sesion,
  parametros,
}: {
  sesion: SesionCantoral
  parametros: ParametrosDeVista
}) {
  const coro = sesion.coroActivo
  if (!coro) return null

  const sp = parametros
  const partituras = puede(sesion.sujeto, 'ensayar_canto') ? await cantosConPartitura() : new Map()
  const { canciones, momentos } = await catalogoDelCoro(coro.id, partituras)
  const veces = repetidas(canciones)
  const nombreMomento = new Map(momentos.map((m) => [m.codigo, m.nombre]))

  const valores = {
    q: sp.q ?? '',
    momento: sp.momento && nombreMomento.has(sp.momento) ? sp.momento : '',
    estado: esEstadoValido(sp.estado) && sp.estado !== 'archivado' ? sp.estado : '',
    partitura: sp.partitura === 'con' || sp.partitura === 'sin' ? sp.partitura : '',
    repetidas: sp.repetidas === '1',
    solistas: sp.solistas === '1',
  }
  const visibles = filtrarCatalogo(
    canciones,
    {
      texto: valores.q,
      momento: valores.momento || undefined,
      estado: valores.estado ? (valores.estado as 'listo' | 'en_ensayo') : undefined,
      partitura: (valores.partitura || undefined) as 'con' | 'sin' | undefined,
      soloRepetidas: valores.repetidas,
      soloConSolistas: valores.solistas,
    },
    veces
  )
  const filtrando = visibles.length !== canciones.length
  // Cuántos filtros están puestos: el número que se ve en «Filtros» plegado.
  const filtrosActivos = [
    valores.momento,
    valores.estado,
    valores.partitura,
    valores.repetidas,
    valores.solistas,
  ].filter(Boolean).length
  const cuantasRepetidas = new Set(
    canciones.filter((c) => veces.has(c.id)).map((c) => claveDeTitulo(c.titulo))
  ).size

  // P2-3 · La página se valida contra lo que quedó después de filtrar: un
  // enlace viejo (?pagina=9) con un filtro nuevo cae en la última que existe.
  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA))
  const pedida = Number.parseInt(sp.pagina ?? '', 10)
  const pagina = Number.isFinite(pedida) ? Math.min(Math.max(pedida, 1), totalPaginas) : 1
  const enPagina = visibles.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  /** El enlace de una página, con los filtros que están puestos. */
  function enlaceDePagina(n: number) {
    const p = new URLSearchParams({ vista: 'todas' })
    if (valores.q.trim()) p.set('q', valores.q.trim())
    if (valores.momento) p.set('momento', valores.momento)
    if (valores.estado) p.set('estado', valores.estado)
    if (valores.partitura) p.set('partitura', valores.partitura)
    if (valores.repetidas) p.set('repetidas', '1')
    if (valores.solistas) p.set('solistas', '1')
    if (n > 1) p.set('pagina', String(n))
    return `/repertorio?${p.toString()}`
  }

  return (
    <>
      {/* La cuenta es lo que se vino a buscar: va primero y grande. */}
      <p className="mt-1 text-base text-texto-tenue">
        <span className="font-semibold text-texto tabular-nums">{canciones.length}</span>{' '}
        {canciones.length === 1 ? 'canción' : 'canciones'}
        {cuantasRepetidas > 0 && (
          <>
            {', '}
            <span className="font-semibold text-texto tabular-nums">{cuantasRepetidas}</span>{' '}
            {cuantasRepetidas === 1 ? 'entró más de una vez' : 'entraron más de una vez'}
          </>
        )}
      </p>

      {/* Filtros plegados (el dueño, 2026-11-20: «simplificado, está pésimo»).
          El buscador del bloque pegajoso sigue siempre a la vista; esto se abre
          solo cuando hace falta. */}
      <details className="group mt-4 rounded-xl border border-borde bg-superficie">
        <summary className="tactil flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 [&::-webkit-details-marker]:hidden">
          <span className="text-sm font-semibold text-texto">Filtros</span>
          {filtrosActivos > 0 && (
            <span className="inline-flex min-w-6 justify-center rounded-full bg-acento px-1.5 text-sm font-bold text-sobre-acento tabular-nums">
              {filtrosActivos}
            </span>
          )}
          <IconoDesplegar className="ml-auto shrink-0 text-texto-tenue transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" />
        </summary>
        <div className="border-t border-borde p-3">
          <Filtros valores={valores} momentos={momentos} />
        </div>
      </details>

      <p role="status" className="mt-3 text-sm text-texto-tenue">
        {filtrando ? `${visibles.length} de ${canciones.length}` : 'Una fila por canción.'}
      </p>

      {visibles.length === 0 ? (
        <p className="mt-4 text-base text-texto-tenue">
          Ninguna canción con estos filtros.{' '}
          <Link href="/repertorio?vista=todas" className="text-acento underline underline-offset-2">
            Quitar los filtros
          </Link>
        </p>
      ) : (
        <ul className="mt-1 border-t border-borde">
          {enPagina.map((c) => {
            const n = veces.get(c.id)
            const susMomentos = c.momentos.map((m) => nombreMomento.get(m) ?? m).join(', ')
            return (
              <li key={c.id} className="border-b border-borde/70 last:border-b-0">
                <Link
                  href={`/repertorio/${c.id}`}
                  className="tactil -mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-superficie"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate">{c.titulo}</span>
                      {c.estado === 'en_ensayo' && (
                        <MarcaEnsayo className="shrink-0 text-texto-tenue" />
                      )}
                      {c.conPartitura && <MarcaPartitura className="shrink-0 text-texto-tenue" />}
                      {c.conSolistas && <MarcaSolistas className="shrink-0 text-texto-tenue" />}
                      {n && <MarcaRepetida veces={n} className="shrink-0 text-peligro" />}
                    </span>
                    {susMomentos && (
                      <span className="mt-0.5 block truncate text-sm text-texto-tenue">{susMomentos}</span>
                    )}
                  </span>
                  <span className="shrink-0 font-cifrado text-sm font-semibold text-acorde">
                    {c.tonalidadOriginal ?? ''}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {/* El paginador. Anterior/Siguiente conservan filtros y búsqueda; el
          «1» se omite de la URL para que la primera página sea la limpia. */}
      {totalPaginas > 1 && (
        <nav
          aria-label="Páginas de las canciones"
          className="mt-4 flex items-center justify-between gap-3 border-t border-borde pt-2"
        >
          {pagina > 1 ? (
            <Link
              href={enlaceDePagina(pagina - 1)}
              className="tactil inline-flex min-h-11 items-center rounded-lg px-2 text-sm text-acento underline underline-offset-2"
            >
              Anterior
            </Link>
          ) : (
            <span aria-hidden className="px-2 text-sm text-texto-tenue opacity-40">
              Anterior
            </span>
          )}
          <span className="text-sm text-texto-tenue tabular-nums">
            Página {pagina} de {totalPaginas}
          </span>
          {pagina < totalPaginas ? (
            <Link
              href={enlaceDePagina(pagina + 1)}
              className="tactil inline-flex min-h-11 items-center rounded-lg px-2 text-sm text-acento underline underline-offset-2"
            >
              Siguiente
            </Link>
          ) : (
            <span aria-hidden className="px-2 text-sm text-texto-tenue opacity-40">
              Siguiente
            </span>
          )}
        </nav>
      )}
    </>
  )
}
