import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { obtenerCanto, obtenerTransposicion, preferenciasDelPerfil } from '@/lib/datos/repertorio'
import { historialDelCanto, hoyISO } from '@/lib/datos/historial'
import { misSugerencias } from '@/lib/datos/sugerencias'
import { contarVersiones } from '@/lib/datos/versiones'
import { misasDelCoro } from '@/lib/datos/misas'
import { partituraPublicada } from '@/lib/datos/partitura'
import { lecturasDeVariasMis } from '@/lib/datos/lecturas'
import type { TipoDeLectura } from '@/lib/motores/lecturas'
import { agruparMisas } from '@/lib/motores/agenda'
import { renderizarCifrado } from '@/lib/motores/renderizar-cifrado'
import { transponer, transponerAcorde } from '@/lib/motores/transponer'
import { acordesDeCanto } from '@/lib/motores/acordes-de-canto'
import { buscarDigitacion } from '@/lib/motores/buscar-digitacion'
import { DIGITACIONES } from '@/lib/motores/digitaciones'
import { etiquetaEstado } from '@/lib/motores/estado-canto'
import Cabecera from '@/app/componentes/cabecera'
import PantallaEncendida from '@/app/componentes/pantalla-encendida'
import { EnlaceIcono, clasesBotonIcono } from '@/app/componentes/boton-icono'
import ConmutadorTema from '@/app/componentes/conmutador-tema'
import { IconoDesplegar, IconoEditar, IconoVolver } from '@/app/componentes/iconos'
import Cifrado from '@/app/componentes/cifrado'
import DarTono from '@/app/componentes/dar-tono'
import { herramientasDelCanto } from '@/lib/datos/herramientas'
import { americanaALatina } from '@/lib/motores/notacion-latina'
import CartaAcorde from '@/app/componentes/carta-acorde'
import Controles from './controles'
import SoloLetra from './solo-letra'
import Notacion from './notacion'
import PanelLectura, { HerramientaDelPanel } from './panel-lectura'
import HistorialDelCanto from './historial-canto'
import Sugerir from './sugerir'
import CorregirAcorde from './corregir'
import MarcarQuienCanta from './marcar-quien-canta'
import PestanasCanto from './pestanas'
import {
  CascaronCarta,
  HojaDiagramas,
  ProveedorDiagramas,
  ZonaAcordes,
} from './diagramas'

export const metadata = { title: 'Canto · Cantoral' }

/**
 * Vista de lectura. Es LA pantalla del producto: se usa de pie, con la guitarra
 * puesta, en la luz baja de una iglesia.
 *
 * Por eso el cifrado va a sangre, sin tarjeta que lo enmarque: el fondo es el
 * papel, y un marco robaría ancho justo donde el ancho decide cuánto se lee.
 *
 * Y por eso esta ruta distingue "no existe" de "no tienes acceso": la RLS no da
 * error, da CERO FILAS, y una pantalla vacía haría creer que el canto no existe
 * (PRD §14).
 */
export default async function CantoPage({ params }: { params: Promise<{ cantoId: string }> }) {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  const { cantoId } = await params
  // H17 · sólo se consulta si hay a quién ofrecerle proponer.
  const puedeSugerir = puede(sesion.sujeto, 'sugerir_canto')
  // H19-A · sólo se cuenta si esta persona puede abrir el historial.
  const puedeVerVersiones = puede(sesion.sujeto, 'ver_versiones_canto')
  const coroId = sesion.coroActivo?.id ?? ''

  const [canto, transposicion, perfil, historial, mias, misas, versiones, partitura] = await Promise.all([
    obtenerCanto(cantoId),
    obtenerTransposicion(cantoId),
    // H11 y 2026-10-17 · Acordes sí/no y tamaño de letra son de la PERSONA, no
    // del canto: por eso no llevan `cantoId`.
    preferenciasDelPerfil(),
    // H13 · Cero tablas nuevas: esto lee las misas que armó H6.
    historialDelCanto(coroId, cantoId),
    puedeSugerir ? misSugerencias(coroId) : Promise.resolve([]),
    puedeSugerir ? misasDelCoro(coroId) : Promise.resolve([]),
    // H19-A · cuántas veces se corrigió el cifrado. Se calcula al leer.
    puedeVerVersiones ? contarVersiones(cantoId) : Promise.resolve(0),
    // H23 · la pestaña «Ensayar» existe solo si hay partitura que ver.
    puede(sesion.sujeto, 'ensayar_canto') ? partituraPublicada(cantoId) : Promise.resolve(null),
  ])

  // Proponer para una misa que ya pasó no tiene sentido; la lista sin fecha sí,
  // porque es una lista de trabajo abierta (§18-6).
  const agenda = agruparMisas(misas, hoyISO())
  const misasProximas = [...agenda.proximas, ...agenda.sinFecha]

  // H30 · qué se lee en cada misa próxima, para mostrarlo al elegirla al proponer.
  // Solo las partes (tipo, cita y texto); la procedencia no se dibuja acá.
  const lecturasPorMisa: Record<
    string,
    { tipo: TipoDeLectura; referencia: string; texto: string }[]
  > = {}
  if (puedeSugerir) {
    const mapa = await lecturasDeVariasMis(misasProximas.map((m) => m.id))
    for (const [id, lista] of mapa) {
      lecturasPorMisa[id] = lista.map(({ tipo, referencia, texto }) => ({ tipo, referencia, texto }))
    }
  }

  if (!canto) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <h1 className="text-lg font-semibold text-peligro">No tienes acceso a este canto</h1>
          <p className="mt-2 max-w-prose text-sm text-texto-tenue">
            Pertenece a un coro del que no eres parte, o ya no existe.
          </p>
          <Link href="/repertorio" className={clasesBotonIcono('borde', 'mt-6 px-4')}>
            Volver a las canciones
          </Link>
        </main>
      </>
    )
  }

  // El cifrado guardado no cambia nunca: la transposición se aplica ACÁ, al
  // leer, sobre los semitonos de la preferencia (PRD decisión 10).
  const { mostrarAcordes, tamanoLetra } = perfil
  const cifradoEnPantalla = transponer(canto.cifrado, transposicion)
  const tonalidadActual = canto.tonalidadOriginal
    ? transponerAcorde(canto.tonalidadOriginal, transposicion)
    : null

  // LOS DIAGRAMAS SE CALCULAN SOBRE EL CIFRADO YA TRANSPUESTO (PRD §9).
  // Si acá dijera `canto.cifrado`, con +2 la pantalla mostraría F# y el
  // diagrama dibujaría E. De acá para abajo `canto.cifrado` no se vuelve a
  // nombrar: hay una sola fuente de la lista de acordes.
  //
  // Con los acordes apagados la lista queda vacía a propósito (H11): sin
  // acordes a la vista, un diagrama no dibuja nada que se pueda relacionar con
  // la pantalla. Eso apaga la hoja de H5 sin tocar una línea de su código.
  const acordes = mostrarAcordes ? acordesDeCanto(cifradoEnPantalla) : []
  const diagramas = acordes.map((nombre) => ({
    nombre,
    digitacion: buscarDigitacion(nombre, DIGITACIONES),
  }))

  // Las «Herramientas» que prendió esta persona (2026-10-17). En Do-Re-Mi solo
  // cambia lo que se LEE: los diagramas y la transposición siguen en americano.
  const herramientas = await herramientasDelCanto(sesion, perfil.herramientas, canto.id)
  const nombrar = (acorde: string) => (herramientas.latina ? americanaALatina(acorde) : acorde)
  // Sin tonalidad declarada, el primer acorde: casi siempre es el tono.
  const tonoParaDar = tonalidadActual ?? acordesDeCanto(cifradoEnPantalla)[0] ?? null
  // Si el canto ya tiene marcado quién canta alguna estrofa. Se consulta acá
  // (y no dentro del cifrado) porque el aviso vive al pie: el cifrado ya no
  // planifica nada encima de la letra (2026-11-17).
  const marcado = renderizarCifrado(cifradoEnPantalla, {
    ancho: 42,
    mostrarAcordes,
    latina: herramientas.latina,
  }).quienCanta.some(Boolean)

  // La fila plegada (2026-11-19) resume, sin abrirse, lo que hay adentro: las
  // correcciones y si el canto ya se estrenó. `versiones` ya viene en 0 cuando
  // esta persona no puede verlas, y quien no puede leer el canto no llega acá.
  const correcciones =
    versiones === 0
      ? 'sin correcciones'
      : versiones === 1
        ? '1 corrección'
        : `${versiones} correcciones`
  const estreno =
    historial.veces === 0
      ? 'sin estrenar'
      : historial.veces === 1
        ? 'cantado 1 vez'
        : `cantado ${historial.veces} veces`
  const resumenSobreElCanto = `${correcciones} · ${estreno}`

  return (
    <>
      {/* SIN cabecera global, a propósito (§DESIGN: «no hay a dónde navegar
          mientras se toca»). Sus dos filas cuestan 83 px en una pantalla donde
          el contenido ES el producto, y el ← de abajo ya devuelve al
          repertorio. Las pantallas de error de más arriba sí la llevan: ahí
          justamente hace falta poder irse a otro lado. */}

      {/* El proveedor no emite DOM, así que <main> sigue siendo hijo flex
          directo del <body> y conserva su `flex-1`. */}
      <ProveedorDiagramas acordes={acordes}>
      <PantallaEncendida />
      <main className="mx-auto w-full max-w-2xl flex-1 pb-20">
        {/* La cinta (maqueta «Teleprompter», 2026-11-18): volver y el nombre, y
            nada más. Los controles no viven acá: se piden tocando un borde o el
            botón de arriba a la derecha (PanelLectura). */}
        <div className="sticky top-0 z-(--z-cabecera) flex items-center gap-1 border-b border-borde bg-fondo py-1 pr-14 pl-1">
          <EnlaceIcono href="/repertorio" etiqueta="Volver a las canciones">
            <IconoVolver />
          </EnlaceIcono>
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-texto-tenue">
            {canto.titulo}
          </h1>
        </div>

        {/* Una línea, y solo con lo que se sabe: sin «Autor no declarado»
            ocupando el mejor lugar de la pantalla. */}
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 px-4 text-sm text-texto-tenue">
          {/* H10 · El miembro tiene que enterarse acá, no solo en el listado:
              esta es la pantalla donde se para a tocar. */}
          {etiquetaEstado(canto.estado) && (
            <span className="rounded border border-borde-fuerte px-1.5 text-sm font-bold text-texto">
              {etiquetaEstado(canto.estado)}
            </span>
          )}
          {[
            canto.autor,
            canto.momentos.map((m) => m.nombre).join(', ') || null,
            canto.tonalidadOriginal ? `original en ${nombrar(canto.tonalidadOriginal)}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
          {herramientas.darTono && tonoParaDar && (
            <DarTono tonalidad={tonoParaDar} etiqueta={nombrar(tonoParaDar)} />
          )}
        </p>

        {partitura && <PestanasCanto cantoId={canto.id} activa="cifrado" />}

        {/* A sangre: el fondo es el papel, sin marco. Pero con su margen: antes
            iba pegado al borde mientras el título tenía 16 px, y los dos bordes
            izquierdos no coincidían. */}
        <div className="mt-5 px-4">
          <ZonaAcordes
            // Solo el director: arrastrar un acorde a su columna (2026-11-17).
            // El miembro ve los diagramas y nada más; la action lo re-comprueba.
            arrastre={
              puede(sesion.sujeto, 'editar_canto')
                ? { cantoId: canto.id, vista: cifradoEnPantalla, transposicion }
                : undefined
            }
          >
            <Cifrado
              cifrado={cifradoEnPantalla}
              tamano={tamanoLetra}
              mostrarAcordes={mostrarAcordes}
              herramientas={herramientas}
            />
          </ZonaAcordes>
        </div>

        {/* El aviso es solo para el canto que NO TIENE acordes. Con los acordes
            apagados a propósito, decir "no tiene acordes" sería mentir (H11). */}
        {mostrarAcordes && acordes.length === 0 && (
          <p className="mt-6 px-4 text-sm text-texto-tenue">Este canto no tiene acordes escritos.</p>
        )}

        {/* Lo que se decide planificando, plegado (2026-11-19): el canto
            termina en el canto. Historial, fuente, tesitura, quién canta,
            correcciones y proponer quedan a un toque. Es un `<details>` nativo:
            abre sin JavaScript, con teclado y con lector de pantalla. */}
        <details className="group mt-8 border-t border-borde px-4 pt-6">
          <summary className="tactil flex cursor-pointer list-none items-center gap-3 [&::-webkit-details-marker]:hidden">
            <h2
              id="sobre-el-canto"
              className="flex min-w-0 flex-1 flex-col text-[0.9375rem] font-bold text-texto"
            >
              Sobre este canto
              {/* El resumen visible no se anuncia: sin esto se oía «Sobre este
                  canto1 corrección». El sr-only lleva su espacio delante. */}
              <span aria-hidden className="text-sm font-normal text-texto-tenue">
                {resumenSobreElCanto}
              </span>
              <span className="sr-only">{` ${resumenSobreElCanto}`}</span>
            </h2>
            <IconoDesplegar className="shrink-0 text-texto-tenue transition-transform duration-150 group-open:rotate-180 motion-reduce:transition-none" />
          </summary>

          <div className="mt-3 flex flex-col gap-4">
            {/* La atribución de la fuente va adentro, arriba del contenido, y
                con ella la salvedad sobre la posición de los acordes: solo
                cuando hay acordes en pantalla (H11). */}
            {canto.fuenteTitulo && (
              <p className="max-w-prose text-sm leading-relaxed text-texto-tenue prosa-equilibrada">
                {canto.fuenteTitulo}
                {canto.fuenteNumero ? `, canto n.º ${canto.fuenteNumero}` : ''}
                {canto.fuentePagina ? `, pág. ${canto.fuentePagina}` : ''}.
                {mostrarAcordes && (
                  <>
                    {' '}
                    Los acordes son de la fuente; dónde cae cada uno sobre la letra es una
                    estimación y se puede corregir a oído.
                  </>
                )}
              </p>
            )}

            {/* H13 · cuánto hace que se cantó y cada cuánto vuelve. */}
            <HistorialDelCanto historial={historial} anioActual={hoyISO().slice(0, 4)} />

            {/* Las herramientas que tocan el cifrado dicen acá lo que falta
                (2026-11-17): la crítica los sacó de antes del primer acorde y
                DESIGN.md manda la planificación al pie. Para el director, el
                marcado de estrofas es esta misma lista, editable. */}
            {herramientas.resaltarMiCuerda && !herramientas.miCuerda && (
              <p className="text-sm text-texto-tenue">
                Para resaltar tu cuerda, elige tu tesitura en{' '}
                <Link href="/mi-perfil" className="underline underline-offset-2 hover:text-texto">
                  Mi perfil
                </Link>
                .
              </p>
            )}
            {herramientas.marcar ? (
              <MarcarQuienCanta cantoId={canto.id} cifrado={cifradoEnPantalla} />
            ) : (herramientas.quienCanta || herramientas.resaltarMiCuerda) && !marcado ? (
              <p className="text-sm text-texto-tenue">
                Este canto todavía no tiene marcado quién canta cada estrofa.
              </p>
            ) : null}

            {/* H19-A · solo si hubo correcciones. Lo ve todo el coro: el que
                toca es el que oye que el acorde cambió. */}
            {versiones > 0 && (
              <Link
                href={`/repertorio/${canto.id}/versiones`}
                className="tactil flex items-center text-sm text-texto-tenue underline underline-offset-2 hover:text-texto"
              >
                {versiones === 1 ? 'Se corrigió 1 vez' : `Se corrigió ${versiones} veces`}: ver qué
                cambió
              </Link>
            )}

            {/* H17 · Proponerlo para un momento o una misa. */}
            {puedeSugerir && (
              <Sugerir
                cantoId={canto.id}
                momentos={canto.momentos}
                misasProximas={misasProximas}
                mias={mias}
                lecturasPorMisa={lecturasPorMisa}
              />
            )}
          </div>
        </details>
      </main>

      {/* La pila inferior: la hoja de diagramas se apila ENCIMA de los
          controles, que siguen accesibles — hay que poder transponer con la
          hoja abierta. El `sticky` vive acá, no dentro de <Controles>. */}
      <div className="relative sticky bottom-0 z-(--z-cabecera)">
        {acordes.length > 0 && (
          <HojaDiagramas
            pie={
              // H19-B · Solo para quien puede editar el canto: el miembro sigue
              // viendo los diagramas y nada más. La action y la RLS lo vuelven
              // a decidir; esto solo evita ofrecer lo que se va a rechazar.
              puede(sesion.sujeto, 'editar_canto') ? (
                <CorregirAcorde
                  cantoId={canto.id}
                  cifrado={cifradoEnPantalla}
                  transposicion={transposicion}
                />
              ) : null
            }
          >
            {diagramas.map((d, i) => (
              <CascaronCarta key={i} indice={i}>
                {/* El SVG se dibuja en el SERVIDOR y baja pintado. */}
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
          {/* Las herramientas que no son de tocar, pedidas junto con la barra
              (maqueta «Teleprompter»): el interruptor de acordes lo usa todo el
              mundo; «Editar», solo el director. */}
          <div className="flex items-center gap-1 px-2 pt-1">
            <SoloLetra mostrarAcordes={mostrarAcordes} />
            <Notacion latina={herramientas.latina} />
            <ConmutadorTema />
            {puede(sesion.sujeto, 'editar_canto') && (
              <HerramientaDelPanel href={`/repertorio/${canto.id}/editar`} etiqueta="Editar el canto">
                <IconoEditar />
              </HerramientaDelPanel>
            )}
          </div>
          <Controles
            cantoId={canto.id}
            coroId={sesion.coroActivo!.id}
            transposicion={transposicion}
            tamanoLetra={tamanoLetra}
            tonalidadActual={tonalidadActual && nombrar(tonalidadActual)}
            mostrarAcordes={mostrarAcordes}
          />
        </PanelLectura>
      </div>
      </ProveedorDiagramas>
    </>
  )
}
