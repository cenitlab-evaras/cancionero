import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { porQueNoEntra, rutaInicial } from '@/lib/permisos'
import BotonSalir from '@/app/componentes/boton-salir'

export const metadata = { title: 'Esperando aprobación · Cantoral' }

/**
 * El portón (PRD §14). Sin esta pantalla, un usuario no aprobado vería la app
 * entera vacía —porque la RLS le devuelve cero filas— y reportaría un bug que
 * no existe.
 *
 * DICE EL MOTIVO VERDADERO, y esa precisión costó un incidente. El 2026-09-03
 * la base migró el rol global de `miembro` a `usuario` y la versión desplegada
 * no conocía ese valor: trató a un director aprobado como externo —correcto,
 * el portón cierra hacia el NO— y esta pantalla le dijo «todavía nadie habilitó
 * tu cuenta». Era falso, y lo mandó a pedirle al administrador algo que ya
 * tenía. El sistema se comportó bien y la pantalla mintió.
 *
 * Los tres motivos son distintos y quien puede resolverlos también: la
 * aprobación la da un admin, el coro lo da un director, y un rol desconocido no
 * lo arregla nadie desde adentro — lo arregla un despliegue.
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

  const motivo = porQueNoEntra({
    aprobado: sesion.sujeto.aprobado,
    rolReconocido: sesion.rolReconocido,
    tieneCoro: sesion.coros.length > 0,
  })

  const correo = <span className="text-texto">{sesion.email}</span>

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
      <h1 className="font-cifrado text-2xl font-bold tracking-tight">Cantoral</h1>

      {motivo === 'rol_desconocido' ? (
        <>
          <h2 className="mt-8 text-lg font-semibold text-balance">
            Tu cuenta está bien; la aplicación está desactualizada
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-texto-tenue">
            Entraste como {correo} y tu cuenta está aprobada. Lo que esta versión de Cantoral no
            reconoce es tu rol: la base de datos ya se actualizó y la aplicación todavía no.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-texto-tenue">
            No es algo que puedas arreglar desde acá, y pedir que te aprueben no va a servir: ya
            estás aprobado. Avísale a quien administra la instalación para que despliegue la versión
            nueva.
          </p>
        </>
      ) : motivo === 'sin_coro' ? (
        <>
          <h2 className="mt-8 text-lg font-semibold text-balance">
            Tu cuenta está aprobada, pero todavía no estás en ningún coro
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-texto-tenue">
            Entraste como {correo}. Falta el segundo paso: que el director de tu coro te agregue.
            Avísale y vas a ver su repertorio en tu próxima entrada.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-texto-tenue">
            Hasta entonces no vas a ver ningún repertorio. No es un error: un repertorio pertenece a
            un coro, y todavía no estás en uno.
          </p>
        </>
      ) : (
        <>
          <h2 className="mt-8 text-lg font-semibold text-balance">
            Tu cuenta está creada y espera aprobación
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-texto-tenue">
            Entraste como {correo}, pero todavía nadie habilitó tu cuenta. Avísale al director de tu
            coro o al administrador para que te apruebe y te agregue.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-texto-tenue">
            Hasta entonces no vas a ver ningún repertorio. No es un error: es el portón.
          </p>
        </>
      )}

      {/* Sin coro no se ofrece «cargar mi perfil»: `editar_ficha_propia` es
          `solo_vinculado`, así que ese enlace llevaría a un «no tienes
          permiso». No hay nada accionable acá; el único botón honesto es salir. */}
      <div className="mt-8">
        <BotonSalir />
      </div>
    </main>
  )
}
