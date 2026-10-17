import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { partituraPublicada } from '@/lib/datos/partitura'
import { obtenerMisa } from '@/lib/datos/misas'
import { obtenerCanto, obtenerTransposicion, preferenciasDelPerfil } from '@/lib/datos/repertorio'
import { recorrido } from '@/lib/motores/misa'
import { transponer, transponerAcorde } from '@/lib/motores/transponer'
import { acordesDeCanto } from '@/lib/motores/acordes-de-canto'
import { buscarDigitacion } from '@/lib/motores/buscar-digitacion'
import { DIGITACIONES } from '@/lib/motores/digitaciones'
import Cabecera from '@/app/componentes/cabecera'
import Cifrado from '@/app/componentes/cifrado'
import CartaAcorde from '@/app/componentes/carta-acorde'
import PantallaEncendida from '@/app/componentes/pantalla-encendida'
import { EnlaceIcono, clasesBotonIcono } from '@/app/componentes/boton-icono'
import { IconoSeguir, IconoVolver } from '@/app/componentes/iconos'
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
 * diagramas— más saber en qué punto de la misa se está y pasar al siguiente
 * **sin volver al listado**.
 *
 * Rediseño del 2026-10-17, porque es LA pantalla de tocar:
 *   · Sin la cabecera global: tenía la navegación entera y «Salir» a un toque,
 *     en plena misa. Ahora es la misma barra de lectura que el canto suelto.
 *   · Respeta «solo letra» (H11). Antes no le pasaba la preferencia al cifrado
 *     y quien canta sin instrumento volvía a ver los acordes en la misa.
 *   · El tamaño de letra es el de la persona, así que no se pierde de un canto
 *     al siguiente.
 *   · «Siguiente» va abajo, al alcance del pulgar, y DICE cuál viene. Antes
 *     estaba al final del contenido: en un canto largo había que bajar hasta el
 *     fondo para encontrarlo.
 *   · Sin el halo: en la lectura y en la ejecución lo único cálido es el acorde.
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
          <h1 className="text-lg font-bold text-peligro">No tienes acceso a esta misa</h1>
          <p className="mt-2 max-w-prose text-texto-tenue">
            Pertenece a un coro del que no eres parte, o ya no existe.
          </p>
          <Link href="/misas" className={clasesBotonIcono('borde', 'mt-6 px-4')}>
            Volver a las misas
          </Link>
        </main>
      </>
    )
  }

  const fila = misa.cantos.find((c) => c.id === filaId)
  if (!fila) redirect(`/misas/${id}`)

  const [canto, transposicion, perfil, partitura] = await Promise.all([
    obtenerCanto(fila.cantoId),
    obtenerTransposicion(fila.cantoId),
    preferenciasDelPerfil(),
    // H23 · el enlace «Ensayar» solo si el canto tiene partitura publicada.
    puede(sesion.sujeto, 'ensayar_canto') ? partituraPublicada(fila.cantoId) : Promise.resolve(null),
  ])
  if (!canto) redirect(`/misas/${id}`)

  const { mostrarAcordes, tamanoLetra } = perfil
  const paso = recorrido(misa.cantos, filaId)
  const siguiente = paso.siguiente ? misa.cantos.find((c) => c.id === paso.siguiente) : null

  const cifradoEnPantalla = transponer(canto.cifrado, transposicion)
  const tonalidadActual = canto.tonalidadOriginal
    ? transponerAcorde(canto.tonalidadOriginal, transposicion)
    : null

  // Sobre el cifrado YA transpuesto, igual que en la vista de lectura (§9). Con
  // los acordes apagados la lista queda vacía y la hoja de diagramas se calla.
  const acordes = mostrarAcordes ? acordesDeCanto(cifradoEnPantalla) : []
  const diagramas = acordes.map((nombre) => ({
    nombre,
    digitacion: buscarDigitacion(nombre, DIGITACIONES),
  }))

  return (
    <>
      <PantallaEncendida />
      <ProveedorDiagramas acordes={acordes}>
        <main className="mx-auto w-full max-w-2xl flex-1 pb-8">
          {/* La cinta de la misa: volver, en qué misa y en qué punto. */}
          <div className="sticky top-0 z-(--z-cabecera) flex items-center gap-1 border-b border-borde bg-fondo py-1 pr-4 pl-1">
            <EnlaceIcono href={`/misas/${misa.id}`} etiqueta="Volver a la misa">
              <IconoVolver />
            </EnlaceIcono>
            <span className="min-w-0 flex-1 truncate text-sm text-texto-tenue">{misa.nombre}</span>
            <span className="shrink-0 text-sm font-bold">
              {paso.posicion} <span className="font-normal text-texto-tenue">de {paso.total}</span>
            </span>
          </div>

          <div className="px-4 pt-4">
            <p className="text-sm text-texto-tenue">{fila.momentoNombre}</p>
            <h1 className="titulo-libro mt-0.5 text-[1.5rem] leading-tight">
              {canto.fuenteNumero && (
                <span className="numero-libro mr-2 font-normal text-texto-tenue">{canto.fuenteNumero}</span>
              )}
              {canto.titulo}
            </h1>
            {(canto.autor || canto.tonalidadOriginal) && (
              <p className="mt-1 text-sm text-texto-tenue">
                {[canto.autor, canto.tonalidadOriginal ? `original en ${canto.tonalidadOriginal}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
            {/* H23 · Para repasar la cuerda antes de la misa. Es un enlace y no
                una pestaña: acá se toca, y la misa sigue siendo lo primero. */}
            {partitura && (
              <Link
                href={`/repertorio/${canto.id}/ensayar`}
                className="tactil mt-1 inline-flex items-center text-sm text-acento underline underline-offset-2"
              >
                Ensayar este canto
              </Link>
            )}
          </div>

          <div className="mt-5 px-4">
            <ZonaAcordes>
              <Cifrado cifrado={cifradoEnPantalla} tamano={tamanoLetra} mostrarAcordes={mostrarAcordes} />
            </ZonaAcordes>
          </div>

          {mostrarAcordes && acordes.length === 0 && (
            <p className="mt-6 px-4 text-sm text-texto-tenue">Este canto no tiene acordes escritos.</p>
          )}
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

          {/* Pasar de canto SIN volver al listado: es el hito entero (H6). */}
          <nav
            aria-label="Cantos de la misa"
            className="border-t border-borde bg-fondo"
          >
            <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-3 pt-2">
              {paso.anterior ? (
                <EnlaceIcono
                  href={`/misas/${misa.id}/${paso.anterior}`}
                  etiqueta="Canto anterior"
                  apariencia="borde"
                >
                  <IconoVolver />
                </EnlaceIcono>
              ) : (
                <span className={clasesBotonIcono('borde', 'opacity-40')} aria-hidden>
                  <IconoVolver />
                </span>
              )}

              {siguiente ? (
                <Link
                  href={`/misas/${misa.id}/${siguiente.id}`}
                  className={clasesBotonIcono('borde', 'min-w-0 flex-1 justify-between px-3')}
                >
                  <span className="min-w-0 truncate text-left">
                    <span className="text-texto-tenue">Siguiente: </span>
                    <span className="font-bold">{siguiente.titulo}</span>
                  </span>
                  <IconoSeguir className="shrink-0" />
                </Link>
              ) : (
                // Fin de la misa. No se esconde el botón: se dice que se terminó.
                <Link
                  href={`/misas/${misa.id}`}
                  className={clasesBotonIcono('borde', 'min-w-0 flex-1 px-3 font-bold')}
                >
                  Terminar la misa
                </Link>
              )}
            </div>
          </nav>

          <Controles
            cantoId={canto.id}
            coroId={sesion.coroActivo!.id}
            transposicion={transposicion}
            tamanoLetra={tamanoLetra}
            tonalidadActual={tonalidadActual}
            mostrarAcordes={mostrarAcordes}
          />
        </div>
      </ProveedorDiagramas>
    </>
  )
}
