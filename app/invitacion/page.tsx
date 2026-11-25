import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { datosDeInvitacion } from '@/lib/datos/invitaciones'
import { obtenerSesion } from '@/lib/sesion'
import { clasesBotonIcono } from '@/app/componentes/boton-icono'
import FormularioInvitacion from './formulario'

export const metadata = { title: 'Invitación · Cantoral' }

/**
 * La pantalla del link de invitación (2026-11-25).
 *
 * NO inventa la marca del coro: muestra el nombre que devuelve la RPC, que solo
 * responde si el token es válido, no venció, no se usó y el correo coincide con
 * la sesión. El skin por coro es otro proyecto.
 *
 * La sesión se comprueba ANTES de pedir los datos: `datosDeInvitacion` levanta
 * «Entra primero» sin sesión, y una invitación nunca se acepta sin estar
 * dentro. Quien llega sin sesión reabre el link del correo —el único que trae
 * el código— o entra con el correo invitado.
 */
export default async function InvitacionPage({
  searchParams,
}: {
  searchParams: Promise<{ inv?: string | string[] }>
}) {
  const { inv } = await searchParams
  const token = typeof inv === 'string' ? inv.trim() : ''

  const sesion = await obtenerSesion()

  if (!sesion) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
        <h1 className="titulo-libro text-[2.25rem] leading-tight">Invitación</h1>
        <p className="mt-4 text-base leading-relaxed text-texto-tenue">
          Para aceptar esta invitación necesitas una sesión. Abre el link que llegó a tu correo y
          vuelve a intentarlo; si ya tienes cuenta, entra con el correo al que te invitaron.
        </p>
        <Link
          href="/entrar"
          className={clasesBotonIcono('lleno', 'mt-8 px-4 text-base')}
        >
          Entrar
        </Link>
      </main>
    )
  }

  const datos = token ? await datosDeInvitacion(token) : null

  if (!datos) {
    return (
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
        <h1 className="titulo-libro text-[2.25rem] leading-tight">Invitación</h1>
        <h2 className="mt-8 text-xl leading-snug font-semibold text-balance">
          La invitación no es válida o venció
        </h2>
        <p className="mt-3 text-base leading-relaxed text-texto-tenue">
          Entraste como <span className="text-texto">{sesion.email}</span>. Puede que el link ya se
          haya usado, que haya vencido o que sea para otro correo. Pide un link nuevo a quien te
          invitó.
        </p>
      </main>
    )
  }

  // `invited_at` distingue la cuenta recién creada por la invitación (todavía
  // sin contraseña) de la que ya existía y llegó por link mágico.
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const nuevo = !!user?.invited_at

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-12">
      <p className="text-sm text-texto-tenue">Te invitaron a</p>
      <h1 className="titulo-libro mt-1 text-[2.25rem] leading-tight text-balance">
        {datos.coroNombre}
      </h1>
      <p className="mt-3 text-base leading-relaxed text-texto-tenue">
        Entrarás como {datos.rolLocal === 'director' ? 'director' : 'miembro'} de este coro.
      </p>

      <FormularioInvitacion inv={token} nuevo={nuevo} />
    </main>
  )
}
