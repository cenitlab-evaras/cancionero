import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { catalogosParaEditar } from '@/lib/datos/repertorio'
import Cabecera from '@/app/componentes/cabecera'
import { EnlaceIcono, clasesBotonIcono } from '@/app/componentes/boton-icono'
import { IconoVolver } from '@/app/componentes/iconos'
import FormularioCanto from '../formulario-canto'

export const metadata = { title: 'Canto nuevo · Cantoral' }

export default async function NuevoCantoPage() {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  // La pantalla consulta la matriz para no ofrecer un formulario que la RLS va
  // a rechazar igual. La seguridad la deciden la RLS y la action (§8.3).
  if (!puede(sesion.sujeto, 'editar_canto')) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <h1 className="text-lg font-semibold text-peligro">
            No tienes permiso para editar el repertorio
          </h1>
          <p className="mt-2 max-w-prose text-sm text-texto-tenue">
            Cargar y corregir cantos es trabajo del director del coro.
          </p>
          <Link href="/repertorio" className={clasesBotonIcono('borde', 'mt-6 px-4')}>
            Volver al repertorio
          </Link>
        </main>
      </>
    )
  }

  const { momentos, autores } = await catalogosParaEditar()

  return (
    <>
      <Cabecera sesion={sesion} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6">
        {/* Segundo nivel: se llega desde Herramientas (antes, desde el
            repertorio; el dueño la mudó el 2026-10-17) y se vuelve ahí. El
            `-ml-3` alinea el trazo de la flecha con el borde del texto: lo que
            se toca es la caja de 44 px, no el dibujo. */}
        <div className="-ml-3 flex items-center gap-1">
          <EnlaceIcono href="/herramientas" etiqueta="Volver a Herramientas">
            <IconoVolver />
          </EnlaceIcono>
          <h1 className="titulo-libro min-w-0 text-[1.75rem] leading-tight">Canto nuevo</h1>
        </div>

        <FormularioCanto
          momentos={momentos}
          autoresConocidos={autores}
          inicial={{
            titulo: '',
            autorNombre: '',
            cifrado: '',
            tonalidadOriginal: '',
            momentoIds: [],
            // Un canto nuevo nace `listo`, igual que el default de la columna:
            // lo más común es cargar el que el coro ya canta (H10).
            estado: 'listo',
            fuenteTitulo: '',
            fuenteNumero: '',
            fuentePagina: '',
          }}
        />
      </main>
    </>
  )
}
