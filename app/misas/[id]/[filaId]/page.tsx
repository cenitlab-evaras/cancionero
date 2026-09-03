import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { obtenerMisa } from '@/lib/datos/misas'
import { obtenerCanto, obtenerPreferencia } from '@/lib/datos/repertorio'
import { recorrido } from '@/lib/motores/misa'
import { transponer, transponerAcorde } from '@/lib/motores/transponer'
import { acordesDeCanto } from '@/lib/motores/acordes-de-canto'
import { buscarDigitacion } from '@/lib/motores/buscar-digitacion'
import { DIGITACIONES } from '@/lib/motores/digitaciones'
import Cabecera from '@/app/componentes/cabecera'
import Cifrado from '@/app/componentes/cifrado'
import CartaAcorde from '@/app/componentes/carta-acorde'
import Controles from '@/app/repertorio/[cantoId]/controles'
import {
  CascaronCarta,
  HojaDiagramas,
  ProveedorDiagramas,
  ZonaAcordes,
} from '@/app/repertorio/[cantoId]/diagramas'

export const metadata = { title: 'Misa · Cantoral' }

/**
 * **Vista de ejecución** (H6): el canto que toca ahora, dentro de la misa.
 *
 * Es la misma lectura de H2–H5 —cifrado, transponer, tamaño, auto scroll,
 * diagramas— más lo único que agrega este hito: saber en qué punto de la misa
 * está el miembro y poder pasar al siguiente **sin volver al listado**, que es
 * literalmente lo que pide el "listo cuando".
 *
 * La navegación la calcula un motor puro y probado; acá solo se pinta.
 */
export default async function EjecucionPage({
  params,
}: {
  params: Promise<{ id: string; filaId: string }>
}) {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  const { id, filaId } = await params
  const misa = await obtenerMisa(id)

  if (!misa) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <h1 className="text-lg font-semibold text-peligro">
            No tienes acceso a esta misa
          </h1>
          <Link
            href="/misas"
            className="mt-6 inline-block text-sm text-acento underline underline-offset-2"
          >
            Volver a las misas
          </Link>
        </main>
      </>
    )
  }

  const fila = misa.cantos.find((c) => c.id === filaId)
  if (!fila) redirect(`/misas/${id}`)

  const [canto, preferencia] = await Promise.all([
    obtenerCanto(fila.cantoId),
    obtenerPreferencia(fila.cantoId),
  ])
  if (!canto) redirect(`/misas/${id}`)

  const paso = recorrido(misa.cantos, filaId)

  const cifradoEnPantalla = transponer(canto.cifrado, preferencia.transposicion)
  const tonalidadActual = canto.tonalidadOriginal
    ? transponerAcorde(canto.tonalidadOriginal, preferencia.transposicion)
    : null

  // Sobre el cifrado YA transpuesto, igual que en la vista de lectura (§9).
  const acordes = acordesDeCanto(cifradoEnPantalla)
  const diagramas = acordes.map((nombre) => ({
    nombre,
    digitacion: buscarDigitacion(nombre, DIGITACIONES),
  }))

  return (
    <>
      <Cabecera sesion={sesion} />

      <ProveedorDiagramas acordes={acordes}>
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-8">
          {/* La cinta de la misa: dónde estás, sin ocupar una barra propia. */}
          <div className="flex items-baseline gap-3 pt-4 text-xs text-texto-tenue">
            <Link
              href={`/misas/${misa.id}`}
              className="-ml-1 shrink-0 rounded px-1 transition-colors hover:text-texto"
              aria-label="Volver a la misa"
            >
              ←
            </Link>
            <span className="min-w-0 truncate">{misa.nombre}</span>
            <span className="ml-auto shrink-0 font-cifrado">
              {paso.posicion} de {paso.total}
            </span>
          </div>

          <div className="mt-2 flex items-baseline gap-3">
            {canto.fuenteNumero && (
              <span className="font-cifrado text-xs text-texto-tenue">{canto.fuenteNumero}</span>
            )}
            <h1 className="min-w-0 text-[1.375rem] leading-tight font-semibold text-balance">
              {canto.titulo}
            </h1>
          </div>

          <p className="mt-1.5 text-xs text-texto-tenue">
            {fila.momentoNombre}
            {canto.autor && <> · {canto.autor}</>}
            {canto.tonalidadOriginal && <> · original en {canto.tonalidadOriginal}</>}
          </p>

          <div className="mt-6">
            <ZonaAcordes>
              <Cifrado cifrado={cifradoEnPantalla} tamano={preferencia.tamanoLetra} />
            </ZonaAcordes>
          </div>

          {acordes.length === 0 && (
            <p className="mt-6 text-xs text-texto-tenue">Este canto no tiene acordes escritos.</p>
          )}

          {/* Pasar al siguiente SIN volver al listado: es el hito entero. */}
          <nav className="mt-10 flex items-stretch gap-2 border-t border-borde pt-4">
            {paso.anterior ? (
              <Link
                href={`/misas/${misa.id}/${paso.anterior}`}
                className="tactil flex flex-1 items-center justify-center rounded-lg border border-borde text-sm transition-colors hover:bg-superficie"
              >
                ← Anterior
              </Link>
            ) : (
              <span className="tactil flex flex-1 items-center justify-center rounded-lg border border-borde text-sm text-texto-tenue opacity-40">
                ← Anterior
              </span>
            )}

            {paso.siguiente ? (
              <Link
                href={`/misas/${misa.id}/${paso.siguiente}`}
                className="tactil flex flex-1 items-center justify-center rounded-lg bg-acento text-sm font-medium text-white"
              >
                Siguiente →
              </Link>
            ) : (
              // Fin de la misa. No se esconde el botón: se dice que se terminó.
              <Link
                href={`/misas/${misa.id}`}
                className="tactil flex flex-1 items-center justify-center rounded-lg border border-borde text-sm transition-colors hover:bg-superficie"
              >
                Fin de la misa
              </Link>
            )}
          </nav>
        </main>

        <div className="relative sticky bottom-0 z-(--z-barra)">
          {acordes.length > 0 && (
            <HojaDiagramas>
              {diagramas.map((d, i) => (
                <CascaronCarta key={i} indice={i}>
                  <CartaAcorde nombre={d.nombre} digitacion={d.digitacion} />
                </CascaronCarta>
              ))}
            </HojaDiagramas>
          )}

          <Controles
            cantoId={canto.id}
            coroId={sesion.coroActivo!.id}
            transposicion={preferencia.transposicion}
            tamanoLetra={preferencia.tamanoLetra}
            tonalidadActual={tonalidadActual}
          />
        </div>
      </ProveedorDiagramas>
    </>
  )
}
