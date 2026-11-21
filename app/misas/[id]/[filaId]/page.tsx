import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { partituraPublicada } from '@/lib/datos/partitura'
import { obtenerMisa } from '@/lib/datos/misas'
import { obtenerCanto, obtenerTransposicion, preferenciasDelPerfil } from '@/lib/datos/repertorio'
import { lecturasDeMisa } from '@/lib/datos/lecturas'
import { fechaLarga } from '@/lib/motores/fecha'
import { recorrido } from '@/lib/motores/misa'
import { tonoEnLaMisa } from '@/lib/motores/tono-en-la-misa'
import { transponer, transponerAcorde } from '@/lib/motores/transponer'
import { acordesDeCanto } from '@/lib/motores/acordes-de-canto'
import { buscarDigitacion } from '@/lib/motores/buscar-digitacion'
import { DIGITACIONES } from '@/lib/motores/digitaciones'
import Cabecera from '@/app/componentes/cabecera'
import Cifrado from '@/app/componentes/cifrado'
import DarTono from '@/app/componentes/dar-tono'
import { herramientasDelCanto } from '@/lib/datos/herramientas'
import { americanaALatina } from '@/lib/motores/notacion-latina'
import CartaAcorde from '@/app/componentes/carta-acorde'
import PantallaEncendida from '@/app/componentes/pantalla-encendida'
import { EnlaceIcono, clasesBotonIcono } from '@/app/componentes/boton-icono'
import ConmutadorTema from '@/app/componentes/conmutador-tema'
import { IconoListo, IconoSeguir, IconoVolver } from '@/app/componentes/iconos'
import Controles from '@/app/repertorio/[cantoId]/controles'
import Notacion from '@/app/repertorio/[cantoId]/notacion'
import PanelLectura from '@/app/repertorio/[cantoId]/panel-lectura'
import {
  CascaronCarta,
  HojaDiagramas,
  ProveedorDiagramas,
  ZonaAcordes,
} from '@/app/repertorio/[cantoId]/diagramas'
import PuertaLecturas from './puerta-lecturas'

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
 *   · «Siguiente» va abajo, al alcance del pulgar, y DICE cuál viene (la
 *     crítica 2026-11-17: había vuelto a chevrones sin texto arriba; ahora la
 *     fila de abajo es la principal y los chevrones quedan como atajo).
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

  const [canto, transposicionPersonal, perfil, partitura, lecturas] = await Promise.all([
    obtenerCanto(fila.cantoId),
    obtenerTransposicion(fila.cantoId),
    preferenciasDelPerfil(),
    // H23 · el enlace «Ensayar» solo si el canto tiene partitura publicada.
    puede(sesion.sujeto, 'ensayar_canto') ? partituraPublicada(fila.cantoId) : Promise.resolve(null),
    // H30 · las lecturas de la misa, para leerlas sin salir del canto. La RLS
    // decide qué filas salen; el lector no hace fetch.
    lecturasDeMisa(misa.id),
  ])
  if (!canto) redirect(`/misas/${id}`)

  const { mostrarAcordes, tamanoLetra } = perfil
  // El título del lector suma la fecha para saber de qué misa son las lecturas
  // cuando se abren desde la ejecución, donde la cinta solo muestra el nombre.
  const tituloLecturas = misa.fecha
    ? `${misa.nombre} · ${fechaLarga(misa.fecha)}`
    : misa.nombre
  // H27 · En la misa manda el tono que fijó el director para ESTA fila; sin
  // fijar, el personal de cada uno, como antes.
  const tono = tonoEnLaMisa(fila.tonoDeMisa, transposicionPersonal)
  const transposicion = tono.semitonos
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

  // Las «Herramientas», igual que en la ficha del canto (2026-10-17). El tono
  // que se da es el de ESTA misa: el que fijó el director, si lo fijó.
  const herramientas = await herramientasDelCanto(sesion, perfil.herramientas, canto.id)
  const nombrar = (acorde: string) => (herramientas.latina ? americanaALatina(acorde) : acorde)
  const tonoParaDar = tonalidadActual ?? acordesDeCanto(cifradoEnPantalla)[0] ?? null

  return (
    <>
      <PantallaEncendida />
      <ProveedorDiagramas acordes={acordes}>
        <main className="mx-auto w-full max-w-2xl flex-1 pb-20">
          {/* La cinta de la misa (maqueta «Teleprompter», 2026-11-18): volver,
              en qué misa y en qué punto. Los chevrones y el tema pasaron al
              panel que se pide; el paso al siguiente vive en la fila del pie. */}
          <div className="sticky top-0 z-(--z-cabecera) flex items-center gap-1 border-b border-borde bg-fondo py-1 pr-14 pl-1">
            <EnlaceIcono href={`/misas/${misa.id}`} etiqueta="Volver a la misa">
              <IconoVolver />
            </EnlaceIcono>
            <span className="min-w-0 flex-1 truncate text-sm text-texto-tenue">{misa.nombre}</span>
            <span className="shrink-0 text-sm font-bold tabular-nums">
              {paso.posicion} <span className="font-normal text-texto-tenue">de {paso.total}</span>
            </span>
            {/* La flecha de la cinta (el dueño, 2026-11-20): se avanza sin
                llegar al pie. El «Siguiente: título» de abajo sigue estando. */}
            {siguiente ? (
              <Link
                href={`/misas/${misa.id}/${siguiente.id}`}
                prefetch
                aria-label={`Siguiente canto: ${siguiente.titulo}`}
                className="tactil inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-texto-tenue hover:text-texto"
              >
                <IconoSeguir tamano={20} />
              </Link>
            ) : (
              <Link
                href={`/misas/${misa.id}`}
                aria-label="Terminar la misa"
                className="tactil inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-texto-tenue hover:text-texto"
              >
                <IconoListo tamano={20} />
              </Link>
            )}
          </div>

          <div className="px-4 pt-4">
            <p className="text-sm text-texto-tenue">{fila.momentoNombre}</p>
            {/* El título manda; «Lecturas» va en su fila, a la derecha, y no
                dibuja nada si la misa no tiene partes guardadas. */}
            <div className="mt-0.5 flex items-start gap-2">
              <h1 className="titulo-libro min-w-0 flex-1 text-[1.5rem] leading-tight">
                {canto.titulo}
              </h1>
              <PuertaLecturas
                partes={lecturas}
                titulo={tituloLecturas}
                tamanoLetra={tamanoLetra}
              />
            </div>
            {(canto.autor || canto.tonalidadOriginal || (herramientas.darTono && tonoParaDar)) && (
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-texto-tenue">
                {[canto.autor, canto.tonalidadOriginal ? `original en ${nombrar(canto.tonalidadOriginal)}` : null]
                  .filter(Boolean)
                  .join(' · ')}
                {herramientas.darTono && tonoParaDar && (
                  <DarTono tonalidad={tonoParaDar} etiqueta={nombrar(tonoParaDar)} />
                )}
              </p>
            )}
            {/* H23 · Para repasar la cuerda antes de la misa. Es un enlace y no
                una pestaña: acá se toca, y la misa sigue siendo lo primero. */}
            {partitura && (
              <Link
                href={`/repertorio/${canto.id}/ensayar?misa=${id}&fila=${filaId}`}
                className="tactil mt-1 inline-flex items-center text-sm text-texto-tenue underline underline-offset-2 hover:text-texto"
              >
                Ensayar este canto
              </Link>
            )}
          </div>

          <div className="mt-5 px-4">
            <ZonaAcordes>
              <Cifrado
                cifrado={cifradoEnPantalla}
                tamano={tamanoLetra}
                mostrarAcordes={mostrarAcordes}
                herramientas={herramientas}
              />
            </ZonaAcordes>
          </div>

          {mostrarAcordes && acordes.length === 0 && (
            <p className="mt-6 px-4 text-sm text-texto-tenue">Este canto no tiene acordes escritos.</p>
          )}
        </main>

        <div className="relative sticky bottom-0 z-(--z-cabecera)">
          {/* «Siguiente: título» abajo, al alcance del pulgar (2026-11-17). La
              fila vive EN la pila fija: no hay que llegar al final del canto
              para pasar al que viene, ni siquiera con la hoja de acordes
              abierta. */}
          {siguiente ? (
            <Link
              href={`/misas/${misa.id}/${siguiente.id}`}
              prefetch
              className="tactil flex min-h-11 items-center gap-2 border-t border-borde bg-fondo px-4 hover:bg-superficie"
            >
              <span className="shrink-0 text-sm text-texto-tenue">Siguiente</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{siguiente.titulo}</span>
              <span className="shrink-0 text-sm font-bold tabular-nums">
                {paso.posicion + 1}{' '}
                <span className="font-normal text-texto-tenue">de {paso.total}</span>
              </span>
              <IconoSeguir tamano={18} className="shrink-0 text-texto-tenue" />
            </Link>
          ) : (
            <Link
              href={`/misas/${misa.id}`}
              className="tactil flex min-h-11 items-center gap-2 border-t border-borde bg-fondo px-4 hover:bg-superficie"
            >
              <span className="flex-1 font-semibold">Terminar la misa</span>
              <IconoListo tamano={18} className="shrink-0 text-texto-tenue" />
            </Link>
          )}
          {acordes.length > 0 && (
            <HojaDiagramas>
              {diagramas.map((d, i) => (
                <CascaronCarta key={i} indice={i}>
                  <CartaAcorde nombre={nombrar(d.nombre)} digitacion={d.digitacion} />
                </CascaronCarta>
              ))}
            </HojaDiagramas>
          )}


          <PanelLectura
            tono={tonalidadActual ? nombrar(tonalidadActual) : null}
            tamano={tamanoLetra}
            mostrarTono={mostrarAcordes}
          >
            {/* Lo que dejó la cinta: el canto anterior y el tema, junto a la
                barra de lectura (maqueta «Teleprompter»). El siguiente sigue en
                la fila del pie, que se ve siempre. */}
            <div className="flex items-center gap-1 px-2 pt-1">
              {paso.anterior ? (
                <EnlaceIcono href={`/misas/${misa.id}/${paso.anterior}`} etiqueta="Canto anterior">
                  <IconoVolver />
                </EnlaceIcono>
              ) : (
                <span className={clasesBotonIcono('plano', 'opacity-30')} aria-hidden>
                  <IconoVolver />
                </span>
              )}
              <Notacion latina={herramientas.latina} />
              <ConmutadorTema />
            </div>
            <Controles
              cantoId={canto.id}
              coroId={sesion.coroActivo!.id}
              transposicion={transposicion}
              tamanoLetra={tamanoLetra}
              tonalidadActual={tonalidadActual && nombrar(tonalidadActual)}
              mostrarAcordes={mostrarAcordes}
              misa={{
                misaId: misa.id,
                filaId: fila.id,
                fijado: tono.fijado,
                puedeFijar: puede(sesion.sujeto, 'asignar_cantos_misa'),
              }}
            />
          </PanelLectura>
        </div>
      </ProveedorDiagramas>
    </>
  )
}
