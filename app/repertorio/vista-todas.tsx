import Link from 'next/link'
import { puede } from '@/lib/permisos'
import type { SesionCantoral } from '@/lib/sesion'
import { catalogoDelCoro } from '@/lib/datos/repertorio'
import { cantosConPartitura } from '@/lib/datos/partitura'
import { claveDeTitulo, filtrarCatalogo, repetidas } from '@/lib/motores/catalogo'
import { esEstadoValido } from '@/lib/motores/estado-canto'
import {
  MarcaEnsayo,
  MarcaLista,
  MarcaPartitura,
  MarcaRepetida,
  MarcaSolistas,
} from '@/app/componentes/marcas'
import Filtros from '@/app/canciones/filtros'

export type ParametrosDeVista = {
  q?: string
  momento?: string
  estado?: string
  partitura?: string
  repetidas?: string
  solistas?: string
}

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
  const cuantasRepetidas = new Set(
    canciones.filter((c) => veces.has(c.id)).map((c) => claveDeTitulo(c.titulo))
  ).size

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

      <div className="mt-5">
        <Filtros valores={valores} momentos={momentos} />
      </div>

      <p role="status" className="mt-4 text-sm text-texto-tenue">
        {filtrando
          ? `${visibles.length} de ${canciones.length}`
          : 'Una fila por canción, con todos sus momentos.'}
      </p>
      {/* La leyenda de los íconos: se aprenden la primera vez. */}
      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-texto-tenue">
        <span className="flex items-center gap-1.5">
          <MarcaLista /> lista
        </span>
        <span className="flex items-center gap-1.5">
          <MarcaEnsayo /> en ensayo
        </span>
        <span className="flex items-center gap-1.5">
          <MarcaPartitura /> con partitura
        </span>
        <span className="flex items-center gap-1.5">
          <MarcaSolistas /> con solista
        </span>
        <span className="flex items-center gap-1.5">
          <MarcaRepetida veces={2} className="text-peligro" /> repetida
        </span>
      </p>

      {visibles.length === 0 ? (
        <p className="mt-6 text-base text-texto-tenue">
          Ninguna canción con estos filtros.{' '}
          <Link href="/repertorio?vista=todas" className="text-acento underline underline-offset-2">
            Quitar los filtros
          </Link>
        </p>
      ) : (
        <table className="mt-2 w-full border-collapse text-left">
          <thead className="sr-only sm:not-sr-only">
            <tr className="border-b border-borde text-sm text-texto-tenue">
              <th scope="col" className="py-2 pr-3 font-normal">
                Canción
              </th>
              <th scope="col" className="hidden py-2 pr-3 font-normal sm:table-cell">
                Momentos
              </th>
              <th scope="col" className="hidden py-2 pr-3 font-normal sm:table-cell">
                Estado
              </th>
              <th scope="col" className="py-2 text-right font-normal">
                Tono
              </th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((c) => {
              const n = veces.get(c.id)
              const susMomentos = c.momentos.map((m) => nombreMomento.get(m) ?? m).join(', ')
              return (
                <tr key={c.id} className="relative border-b border-borde align-top">
                  <td className="py-2.5 pr-3">
                    <span className="flex items-center gap-2">
                      {/* La fila entera abre el canto: `after` cubre el tr.
                          Antes solo el texto tenía 24 px de alto. */}
                      <Link
                        href={`/repertorio/${c.id}`}
                        className="font-medium after:absolute after:inset-0 after:content-[''] hover:underline"
                      >
                        {c.titulo}
                      </Link>
                      {/* En el teléfono no hay columna de estado: va al lado. */}
                      {c.estado === 'en_ensayo' && <MarcaEnsayo className="text-texto sm:hidden" />}
                      {c.conPartitura && <MarcaPartitura className="text-texto-tenue" />}
                      {c.conSolistas && <MarcaSolistas className="text-texto-tenue" />}
                      {n && <MarcaRepetida veces={n} className="text-peligro" />}
                    </span>
                    {/* La página del cancionero va bajo el título: es la
                        referencia que el coro usa para encontrarlo. */}
                    {c.fuentePagina !== null && (
                      <span className="mt-1 block text-sm text-texto-tenue tabular-nums">
                        pág. {c.fuentePagina}
                      </span>
                    )}
                    {/* En el teléfono los momentos van acá: no caben columnas. */}
                    {susMomentos && (
                      <span className="mt-1 block text-sm text-texto-tenue sm:hidden">{susMomentos}</span>
                    )}
                  </td>
                  <td className="hidden py-2.5 pr-3 text-sm text-texto-tenue sm:table-cell">
                    {susMomentos || '—'}
                  </td>
                  <td className="hidden py-2.5 pr-3 sm:table-cell">
                    {c.estado === 'en_ensayo' ? (
                      <MarcaEnsayo className="text-texto" />
                    ) : (
                      <MarcaLista className="text-texto-tenue" />
                    )}
                  </td>
                  <td className="py-2.5 text-right text-sm font-semibold text-acorde">
                    {c.tonalidadOriginal ?? ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </>
  )
}
