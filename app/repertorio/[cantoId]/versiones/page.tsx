import Link from 'next/link'
import { redirect } from 'next/navigation'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { obtenerCanto } from '@/lib/datos/repertorio'
import { versionesDeCanto } from '@/lib/datos/versiones'
import { armarHistorial, diffLineas } from '@/lib/motores/version-cifrado'
import { describirAntiguedad } from '@/lib/motores/historial'
import { fechaEnZona } from '@/lib/motores/fecha'
import Cabecera from '@/app/componentes/cabecera'
import Restaurar from './restaurar'

export const metadata = { title: 'Historial de cambios · Cantoral' }

/** Días enteros entre dos fechas ISO, contados en la zona del coro. */
function diasEntre(desde: string, hasta: string): number {
  const ms = Date.parse(`${hasta}T12:00:00Z`) - Date.parse(`${desde}T12:00:00Z`)
  return Math.max(0, Math.round(ms / 86_400_000))
}

/**
 * El historial de cambios del cifrado (H19-A · §18-13).
 *
 * LO VE TODO EL CORO, no solo el director. PRODUCT define el éxito como «que la
 * corrección que hace un músico le llegue a los demás»: el que abre un canto y
 * ve un acorde distinto al que recuerda tiene derecho a saber que cambió ayer y
 * quién lo cambió. Volver atrás sí es del director.
 *
 * El despliegue de cada cambio es un `<details>` nativo: sin JavaScript, con
 * teclado, y sin que el estado abierto/cerrado dependa de una hidratación que
 * en la iglesia puede llegar tarde.
 */
export default async function VersionesPage({ params }: { params: Promise<{ cantoId: string }> }) {
  const sesion = await obtenerSesion()
  if (!sesion) redirect('/entrar')
  if (!sesion.sujeto.aprobado) redirect('/esperando-aprobacion')

  const { cantoId } = await params

  // Las dos capas de §15-4: la pantalla no se ofrece, y por URL tampoco entra.
  if (!puede(sesion.sujeto, 'ver_versiones_canto')) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <h1 className="text-lg font-semibold text-peligro">
            No tienes permiso para ver este historial
          </h1>
          <p className="mt-2 max-w-prose text-sm text-texto-tenue">
            El historial de un canto lo ve el coro al que pertenece.
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

  const [canto, versiones] = await Promise.all([obtenerCanto(cantoId), versionesDeCanto(cantoId)])

  // La RLS no da error, da cero filas: sin esto una pantalla vacía haría creer
  // que el canto no existe (§14).
  if (!canto) {
    return (
      <>
        <Cabecera sesion={sesion} />
        <main className="mx-auto w-full max-w-2xl px-4 py-10">
          <h1 className="text-lg font-semibold">Ese canto no está acá</h1>
          <p className="mt-2 max-w-prose text-sm text-texto-tenue">
            O no existe, o es de un coro al que no perteneces.
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

  const cambios = armarHistorial(versiones, canto.cifrado)
  const puedeRestaurar = puede(sesion.sujeto, 'restaurar_version_canto')
  const hoy = fechaEnZona(new Date())

  return (
    <>
      <Cabecera sesion={sesion} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-16">
        <div className="flex items-baseline gap-3 pt-4">
          <Link
            href={`/repertorio/${cantoId}`}
            className="-ml-1 shrink-0 rounded px-1 text-sm text-texto-tenue transition-colors hover:text-texto"
            aria-label="Volver al canto"
          >
            ←
          </Link>
          <h1 className="min-w-0 text-[1.375rem] leading-tight font-semibold">Historial</h1>
        </div>
        <p className="mt-0.5 pl-7 text-sm text-texto-tenue">{canto.titulo}</p>

        {cambios.length === 0 ? (
          // Un estado vacío explica POR QUÉ está vacío (§14). Y acá dice algo
          // que importa: no es que falte el dato, es que el cifrado es el
          // original tal como se cargó.
          <p className="mt-6 max-w-prose text-sm text-texto-tenue">
            Este canto no se editó nunca. El cifrado es el que se cargó la primera vez; cuando
            alguien lo corrija, cada cambio va a quedar acá con quién lo hizo y cuándo.
          </p>
        ) : (
          <>
            <p className="mt-4 text-xs text-texto-tenue">
              {cambios.length === 1 ? '1 cambio' : `${cambios.length} cambios`} · del más reciente
              al más antiguo
            </p>

            <ol className="mt-3 space-y-3">
              {cambios.map((cambio, i) => {
                const lineas = diffLineas(cambio.antes, cambio.despues)
                const sinCambios = lineas.filter((l) => l.tipo === 'igual').length
                const cambiadas = lineas.filter((l) => l.tipo !== 'igual')
                const cuando = cambio.cuando.slice(0, 10)

                return (
                  <li key={cambio.id} className="rounded-lg border border-borde px-3 py-2.5">
                    <p className="text-sm font-medium">{cambio.descripcion}</p>
                    <p className="mt-0.5 text-xs text-texto-tenue">
                      {/* Sin quién, no se inventa un nombre: se dice qué se sabe. */}
                      {cambio.quien ?? 'Sin identificar'} · {describirAntiguedad(diasEntre(cuando, hoy))}
                      {i === 0 && ' · es lo que se canta hoy'}
                    </p>

                    <details className="mt-2 group">
                      <summary className="tactil inline-flex cursor-pointer items-center text-xs text-acento underline underline-offset-2">
                        Ver qué cambió
                      </summary>

                      {/* Solo las líneas que cambiaron: en 360 px, repetir las
                          cuarenta que quedaron iguales esconde justo lo que se
                          vino a mirar. */}
                      <div className="mt-2 overflow-x-auto">
                        <pre className="font-mono text-[0.6875rem] leading-relaxed whitespace-pre">
                          {cambiadas.map((l, k) => (
                            <span
                              key={k}
                              className={
                                l.tipo === 'quitada'
                                  ? 'block text-peligro'
                                  : 'block text-[var(--color-acento)]'
                              }
                            >
                              {l.tipo === 'quitada' ? '− ' : '+ '}
                              {l.texto || ' '}
                            </span>
                          ))}
                        </pre>
                      </div>
                      {sinCambios > 0 && (
                        <p className="mt-1.5 text-xs text-texto-tenue">
                          {sinCambios === 1
                            ? '1 línea sin cambios'
                            : `${sinCambios} líneas sin cambios`}
                        </p>
                      )}

                      {puedeRestaurar && (
                        <Restaurar
                          cantoId={cantoId}
                          versionId={cambio.id}
                          descripcion={cambio.descripcion}
                        />
                      )}
                    </details>
                  </li>
                )
              })}
            </ol>
          </>
        )}
      </main>
    </>
  )
}
