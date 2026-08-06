import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { obtenerCanto, obtenerPreferencia } from '@/lib/datos/repertorio'
import { transponer, transponerAcorde } from '@/lib/motores/transponer'
import { acordesDeCanto } from '@/lib/motores/acordes-de-canto'
import { buscarDigitacion } from '@/lib/motores/buscar-digitacion'
import { DIGITACIONES } from '@/lib/motores/digitaciones'
import Cabecera from '@/app/componentes/cabecera'
import Cifrado from '@/app/componentes/cifrado'
import CartaAcorde from '@/app/componentes/carta-acorde'
import Controles from './controles'
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
  const [canto, preferencia] = await Promise.all([
    obtenerCanto(cantoId),
    obtenerPreferencia(cantoId),
  ])

  if (!canto) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <h1 className="text-lg font-semibold text-peligro">No tienes acceso a este canto</h1>
          <p className="mt-2 max-w-prose text-sm text-texto-tenue">
            Pertenece a un coro del que no eres parte, o ya no existe. No es una pantalla vacía: es
            falta de acceso.
          </p>
          <Link
            href="/repertorio"
            className="mt-6 inline-block text-sm text-acento underline underline-offset-2"
          >
            Volver al repertorio
          </Link>
        </main>
      </>
    )
  }

  // El cifrado guardado no cambia nunca: la transposición se aplica ACÁ, al
  // leer, sobre los semitonos de la preferencia (PRD decisión 10).
  const cifradoEnPantalla = transponer(canto.cifrado, preferencia.transposicion)
  const tonalidadActual = canto.tonalidadOriginal
    ? transponerAcorde(canto.tonalidadOriginal, preferencia.transposicion)
    : null

  // LOS DIAGRAMAS SE CALCULAN SOBRE EL CIFRADO YA TRANSPUESTO (PRD §9).
  // Si acá dijera `canto.cifrado`, con +2 la pantalla mostraría F# y el
  // diagrama dibujaría E. De acá para abajo `canto.cifrado` no se vuelve a
  // nombrar: hay una sola fuente de la lista de acordes.
  const acordes = acordesDeCanto(cifradoEnPantalla)
  const diagramas = acordes.map((nombre) => ({
    nombre,
    digitacion: buscarDigitacion(nombre, DIGITACIONES),
  }))

  return (
    <>
      <Cabecera sesion={sesion} />

      {/* El proveedor no emite DOM, así que <main> sigue siendo hijo flex
          directo del <body> y conserva su `flex-1`. */}
      <ProveedorDiagramas acordes={acordes}>
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-8">
        <div className="flex items-baseline gap-3 pt-4">
          <Link
            href="/repertorio"
            className="-ml-1 shrink-0 rounded px-1 text-sm text-texto-tenue transition-colors hover:text-texto"
            aria-label="Volver al repertorio"
          >
            ←
          </Link>
          {canto.fuenteNumero && (
            <span className="font-cifrado text-xs text-texto-tenue">{canto.fuenteNumero}</span>
          )}
          <h1 className="min-w-0 text-[1.375rem] leading-tight font-semibold text-balance">
            {canto.titulo}
          </h1>
          {/* Corregir un acorde a oído es trabajo esperable (§17.1): el acceso
              vive donde se descubre el error, no en un menú aparte. */}
          {puede(sesion.sujeto, 'editar_canto') && (
            <Link
              href={`/repertorio/${canto.id}/editar`}
              className="ml-auto shrink-0 rounded px-1 text-xs text-texto-tenue transition-colors hover:text-texto"
            >
              Editar
            </Link>
          )}
        </div>

        <p className="mt-1.5 pl-7 text-xs text-texto-tenue">
          {canto.autor ?? 'Autor no declarado en la fuente'}
          {canto.momentos.length > 0 && <> · {canto.momentos.join(', ')}</>}
          {canto.tonalidadOriginal && <> · original en {canto.tonalidadOriginal}</>}
        </p>

        {/* A sangre: el fondo es el papel. */}
        <div className="mt-6">
          <ZonaAcordes>
            <Cifrado cifrado={cifradoEnPantalla} tamano={preferencia.tamanoLetra} />
          </ZonaAcordes>
        </div>

        {acordes.length === 0 && (
          // §14: no es un fallo del motor ni una pantalla vacía. Se dice el
          // motivo y se sigue mostrando la letra.
          <p className="mt-6 text-xs text-texto-tenue">Este canto no tiene acordes escritos.</p>
        )}

        {canto.fuenteTitulo && (
          <p className="mt-10 border-t border-borde pt-4 text-[0.6875rem] leading-relaxed text-texto-tenue">
            {canto.fuenteTitulo}
            {canto.fuenteNumero ? `, canto n.º ${canto.fuenteNumero}` : ''}
            {canto.fuentePagina ? `, pág. ${canto.fuentePagina}` : ''}. Los acordes son de la fuente;
            dónde cae cada uno sobre la letra es una estimación y se puede corregir a oído.
          </p>
        )}
      </main>

      {/* La pila inferior: la hoja de diagramas se apila ENCIMA de los
          controles, que siguen accesibles — hay que poder transponer con la
          hoja abierta. El `sticky` vive acá, no dentro de <Controles>. */}
      <div className="relative sticky bottom-0 z-(--z-barra)">
        {acordes.length > 0 && (
          <HojaDiagramas>
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
          transposicion={preferencia.transposicion}
          tamanoLetra={preferencia.tamanoLetra}
          tonalidadActual={tonalidadActual}
        />
      </div>
      </ProveedorDiagramas>
    </>
  )
}
