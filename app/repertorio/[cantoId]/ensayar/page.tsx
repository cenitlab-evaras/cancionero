import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { obtenerCanto } from '@/lib/datos/repertorio'
import { materialDeEnsayo, partituraPublicada } from '@/lib/datos/partitura'
import { miFicha } from '@/lib/datos/ficha'
import { esTesituraValida } from '@/lib/motores/ficha'
import { cuerdaPorTesitura } from '@/lib/motores/cuerdas'
import Cabecera from '@/app/componentes/cabecera'
import PantallaEncendida from '@/app/componentes/pantalla-encendida'
import { EnlaceIcono, clasesBotonIcono } from '@/app/componentes/boton-icono'
import { IconoVolver } from '@/app/componentes/iconos'
import PestanasCanto from '../pestanas'
import Reproductor from './reproductor'

export const metadata = { title: 'Ensayar · Cantoral' }

/**
 * H23 · Ensayar: el reproductor de la partitura publicada (PRD §21.7).
 *
 * Distingue tres cosas que una pantalla vacía confundiría (§14):
 *   · el canto no existe o es de otro coro → «no tienes acceso»;
 *   · el canto no tiene partitura publicada → se dice, y se vuelve al cifrado;
 *   · la partitura existe pero Storage no deja firmar sus archivos → «no
 *     tienes acceso» (§21.4: la firma falla con la sesión de quien no puede).
 */
export default async function EnsayarPage({ params }: { params: Promise<{ cantoId: string }> }) {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  const { cantoId } = await params
  const [canto, partitura] = await Promise.all([obtenerCanto(cantoId), partituraPublicada(cantoId)])

  const material =
    canto && partitura && puede(sesion.sujeto, 'ensayar_canto') ? await materialDeEnsayo(partitura) : null

  if (!canto || (partitura && !material)) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-10">
          <h1 className="titulo-libro text-[1.75rem] leading-tight text-peligro">
            No tienes acceso a este canto
          </h1>
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

  if (!material) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-10">
          <h1 className="titulo-libro text-[1.75rem] leading-tight">{canto.titulo}</h1>
          <p className="mt-2 max-w-prose text-base text-texto-tenue">
            Este canto todavía no tiene partitura para ensayar.
          </p>
          <Link href={`/repertorio/${canto.id}`} className={clasesBotonIcono('borde', 'mt-6 px-4')}>
            Ver el cifrado
          </Link>
        </main>
      </>
    )
  }

  // Con qué cuerda abre: la de la tesitura de la ficha (H14), o el coro.
  const ficha = sesion.coroActivo ? await miFicha(sesion.coroActivo.id) : null
  const tesitura = esTesituraValida(ficha?.tesitura) ? ficha.tesitura : null
  const cuerdaInicial = cuerdaPorTesitura(tesitura, material.cuerdas)

  return (
    <>
      <PantallaEncendida />
      <main className="mx-auto w-full max-w-2xl flex-1">
        {/* La misma cabecera de lectura que el cifrado: volver y el nombre. */}
        <div className="sticky top-0 z-(--z-cabecera) flex items-center gap-1 border-b border-borde bg-fondo py-1 pr-2 pl-1">
          <EnlaceIcono href="/repertorio" etiqueta="Volver al repertorio">
            <IconoVolver />
          </EnlaceIcono>
          <h1 className="titulo-libro min-w-0 flex-1 text-[1.375rem] leading-tight">
            {canto.fuenteNumero && (
              <span className="numero-libro mr-2 font-normal text-texto-tenue">{canto.fuenteNumero}</span>
            )}
            {canto.titulo}
          </h1>
        </div>

        <PestanasCanto cantoId={canto.id} activa="ensayar" />

        <Reproductor material={material} cuerdaInicial={cuerdaInicial} />
      </main>
    </>
  )
}
