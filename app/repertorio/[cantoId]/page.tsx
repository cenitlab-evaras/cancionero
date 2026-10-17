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
import { agruparMisas } from '@/lib/motores/agenda'
import { transponer, transponerAcorde } from '@/lib/motores/transponer'
import { acordesDeCanto } from '@/lib/motores/acordes-de-canto'
import { buscarDigitacion } from '@/lib/motores/buscar-digitacion'
import { DIGITACIONES } from '@/lib/motores/digitaciones'
import { etiquetaEstado } from '@/lib/motores/estado-canto'
import Cabecera from '@/app/componentes/cabecera'
import PantallaEncendida from '@/app/componentes/pantalla-encendida'
import TituloSeccion from '@/app/componentes/titulo-seccion'
import { EnlaceIcono, clasesBotonIcono } from '@/app/componentes/boton-icono'
import ConmutadorTema from '@/app/componentes/conmutador-tema'
import { IconoEditar, IconoVolver } from '@/app/componentes/iconos'
import Cifrado from '@/app/componentes/cifrado'
import CartaAcorde from '@/app/componentes/carta-acorde'
import Controles from './controles'
import SoloLetra from './solo-letra'
import HistorialDelCanto from './historial-canto'
import Sugerir from './sugerir'
import CorregirAcorde from './corregir'
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
            Volver al repertorio
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
      <main className="mx-auto w-full max-w-2xl flex-1 pb-8">
        {/* La cabecera de lectura: lo único que hace falta acá —volver, saber
            qué canto es, y los dos controles que no son de tocar—, cada uno con
            su objetivo de 44 px (antes el ← medía 23×20 y «Editar» 41×16). Va
            fija porque volver tiene que estar a mano después de media misa. */}
        <div className="sticky top-0 z-(--z-cabecera) flex items-center gap-1 border-b border-borde bg-fondo py-1 pr-2 pl-1">
          <EnlaceIcono href="/repertorio" etiqueta="Volver al repertorio">
            <IconoVolver />
          </EnlaceIcono>
          <h1 className="titulo-libro min-w-0 flex-1 text-[1.375rem] leading-tight">
            {canto.titulo}
          </h1>
          {/* H11 · El interruptor de acordes va antes que «Editar» porque lo usa
              todo el mundo y «Editar» solo el director: el orden lo decide quién
              lo toca, no la jerarquía. */}
          <SoloLetra mostrarAcordes={mostrarAcordes} />
          <ConmutadorTema />
          {/* Corregir un acorde a oído es trabajo esperable (§17.1): el acceso
              vive donde se descubre el error, no en un menú aparte. */}
          {puede(sesion.sujeto, 'editar_canto') && (
            <EnlaceIcono href={`/repertorio/${canto.id}/editar`} etiqueta="Editar el canto">
              <IconoEditar />
            </EnlaceIcono>
          )}
        </div>

        {/* Una línea, y solo con lo que se sabe: sin «Autor no declarado»
            ocupando el mejor lugar de la pantalla. */}
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 px-4 text-sm text-texto-tenue">
          {/* H10 · El miembro tiene que enterarse acá, no solo en el listado:
              esta es la pantalla donde se para a tocar. */}
          {etiquetaEstado(canto.estado) && (
            <span className="rounded border border-borde-fuerte px-1.5 text-xs font-bold text-texto">
              {etiquetaEstado(canto.estado)}
            </span>
          )}
          {[
            canto.autor,
            canto.momentos.map((m) => m.nombre).join(', ') || null,
            canto.tonalidadOriginal ? `original en ${canto.tonalidadOriginal}` : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>

        {partitura && <PestanasCanto cantoId={canto.id} activa="cifrado" />}

        {/* A sangre: el fondo es el papel, sin marco. Pero con su margen: antes
            iba pegado al borde mientras el título tenía 16 px, y los dos bordes
            izquierdos no coincidían. */}
        <div className="mt-5 px-4">
          <ZonaAcordes>
            <Cifrado cifrado={cifradoEnPantalla} tamano={tamanoLetra} mostrarAcordes={mostrarAcordes} />
          </ZonaAcordes>
        </div>

        {/* El aviso es solo para el canto que NO TIENE acordes. Con los acordes
            apagados a propósito, decir "no tiene acordes" sería mentir (H11). */}
        {mostrarAcordes && acordes.length === 0 && (
          <p className="mt-6 px-4 text-sm text-texto-tenue">Este canto no tiene acordes escritos.</p>
        )}

        {canto.fuenteTitulo && (
          <p className="mt-10 max-w-prose px-4 text-sm leading-relaxed text-texto-tenue">
            {canto.fuenteTitulo}
            {canto.fuenteNumero ? `, canto n.º ${canto.fuenteNumero}` : ''}
            {canto.fuentePagina ? `, pág. ${canto.fuentePagina}` : ''}.
            {/* La atribución va siempre (§18-1); la salvedad sobre la posición
                de los acordes, solo cuando hay acordes en pantalla (H11). */}
            {mostrarAcordes && (
              <>
                {' '}
                Los acordes son de la fuente; dónde cae cada uno sobre la letra es una estimación y
                se puede corregir a oído.
              </>
            )}
          </p>
        )}

        {/* Lo que se decide planificando, DESPUÉS del canto y no antes
            (rediseño 2026-10-17): el historial, proponerlo y sus correcciones.
            Antes iba entre el título y el cifrado, y el primer acorde quedaba a
            224 px. */}
        <section aria-labelledby="sobre-el-canto" className="mt-8 border-t border-borde px-4 pt-6">
          <TituloSeccion id="sobre-el-canto">Sobre este canto</TituloSeccion>
          <div className="mt-3 flex flex-col gap-4">
            {/* H13 · cuánto hace que se cantó y cada cuánto vuelve. */}
            <HistorialDelCanto historial={historial} anioActual={hoyISO().slice(0, 4)} />

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
              />
            )}
          </div>
        </section>
      </main>

      {/* La pila inferior: la hoja de diagramas se apila ENCIMA de los
          controles, que siguen accesibles — hay que poder transponer con la
          hoja abierta. El `sticky` vive acá, no dentro de <Controles>. */}
      <div className="relative sticky bottom-0 z-(--z-barra)">
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
                <CartaAcorde nombre={d.nombre} digitacion={d.digitacion} />
              </CascaronCarta>
            ))}
          </HojaDiagramas>
        )}

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
