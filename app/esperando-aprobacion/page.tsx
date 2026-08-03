import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { rutaInicial } from '@/lib/permisos'
import BotonSalir from '@/app/componentes/boton-salir'

export const metadata = { title: 'Esperando aprobación · Cantoral' }

/**
 * El portón (PRD §14). Sin esta pantalla, un usuario no aprobado vería la app
 * entera vacía —porque la RLS le devuelve cero filas— y reportaría un bug que
 * no existe.
 *
 * El texto explica el motivo y qué hacer. No se disculpa ni celebra nada.
 */
export default async function EsperandoAprobacionPage() {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')

  // Si ya lo aprobaron, que no se quede acá encerrado.
  if (sesion.sujeto.aprobado && rutaInicial(sesion.sujeto) !== '/esperando-aprobacion') {
    redirect(rutaInicial(sesion.sujeto))
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
      <h1 className="font-cifrado text-2xl font-bold tracking-tight">Cantoral</h1>

      <h2 className="mt-8 text-lg font-semibold text-balance">
        Tu cuenta está creada y espera aprobación
      </h2>

      <p className="mt-3 text-sm leading-relaxed text-texto-tenue">
        Entraste como <span className="text-texto">{sesion.email}</span>, pero todavía nadie habilitó
        tu cuenta. Avísale al director de tu coro o al administrador para que te apruebe y te
        agregue.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-texto-tenue">
        Hasta entonces no vas a ver ningún repertorio. No es un error: es el portón.
      </p>

      <div className="mt-8">
        <BotonSalir />
      </div>
    </main>
  )
}
