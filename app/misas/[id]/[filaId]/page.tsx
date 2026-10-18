import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { partituraPublicada } from '@/lib/datos/partitura'
import { obtenerMisa } from '@/lib/datos/misas'
import { obtenerCanto, obtenerTransposicion, preferenciasDelPerfil } from '@/lib/datos/repertorio'
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

  const [canto, transposicionPersonal, perfil, partitura] = await Promise.all([
    obtenerCanto(fila.cantoId),
    obtenerTransposicion(fila.cantoId),
    preferenciasDelPerfil(),
    // H23 · el enlace «Ensayar» solo si el canto tiene partitura publicada.
    puede(sesion.sujeto, 'ensayar_canto') ? partituraPublicada(fila.cantoId) : Promise.resolve(null),
  ])
  if (!canto) redirect(`/misas/${id}`)

  const { mostrarAcordes, tamanoLetra } = perfil
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
        <main className="mx-auto w-full max-w-2xl flex-1 pb-8">
          {/* La cinta de la misa: volver, en qué misa y en qué punto. */}
          <div className="sticky top-0 z-(--z-cabecera) flex items-center gap-1 border-b border-borde bg-fondo py-1 pr-4 pl-1">
            <EnlaceIcono href={`/misas/${misa.id}`} etiqueta="Volver a la misa">
              <IconoVolver />
            </EnlaceIcono>
            <span className="min-w-0 flex-1 truncate text-sm text-texto-tenue">{misa.nombre}</span>
            {/* Pasar de canto SIN volver al listado: es el hito entero (H6). Va
                acá arriba y en chico (el dueño, 2026-10-17: abajo era una barra
                que no tenía por qué estar ni ser tan grande). El título del que
                sigue va en el nombre accesible. */}
            {paso.anterior ? (
              <EnlaceIcono href={`/misas/${misa.id}/${paso.anterior}`} etiqueta="Canto anterior">
                <IconoVolver tamano={18} />
              </EnlaceIcono>
            ) : (
              <span className={clasesBotonIcono('plano', 'opacity-30')} aria-hidden>
                <IconoVolver tamano={18} />
              </span>
            )}
            <span className="shrink-0 text-sm font-bold tabular-nums">
              {paso.posicion} <span className="font-normal text-texto-tenue">de {paso.total}</span>
            </span>
            {siguiente ? (
              <EnlaceIcono href={`/misas/${misa.id}/${siguiente.id}`} etiqueta={`Siguiente: ${siguiente.titulo}`}>
                <IconoSeguir tamano={18} />
              </EnlaceIcono>
            ) : (
              // Fin de la misa: no se esconde, se dice que se terminó.
              <EnlaceIcono href={`/misas/${misa.id}`} etiqueta="Terminar la misa">
                <IconoListo tamano={18} />
              </EnlaceIcono>
            )}
            <ConmutadorTema className="-mr-2" />
          </div>

          <div className="px-4 pt-4">
            <p className="text-sm text-texto-tenue">{fila.momentoNombre}</p>
            <h1 className="titulo-libro mt-0.5 text-[1.5rem] leading-tight">
              {canto.titulo}
            </h1>
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
                className="tactil mt-1 inline-flex items-center text-sm text-acento underline underline-offset-2"
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

        <div className="relative sticky bottom-0 z-(--z-barra)">
          {acordes.length > 0 && (
            <HojaDiagramas>
              {diagramas.map((d, i) => (
                <CascaronCarta key={i} indice={i}>
                  <CartaAcorde nombre={nombrar(d.nombre)} digitacion={d.digitacion} />
                </CascaronCarta>
              ))}
            </HojaDiagramas>
          )}


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
        </div>
      </ProveedorDiagramas>
    </>
  )
}
