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
import TituloSeccion from '@/app/componentes/titulo-seccion'
import { EnlaceIcono, clasesBotonIcono } from '@/app/componentes/boton-icono'
import { IconoAgregar, IconoQuitar, IconoVolver } from '@/app/componentes/iconos'
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
 *
 * Rediseño 2026-10-17: es de segundo nivel —se entra desde el canto y se
 * vuelve a él—, y los cambios son filas separadas por una línea, no tarjetas.
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
          <Link href="/repertorio" className={clasesBotonIcono('borde', 'mt-6 px-4')}>
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
          <Link href="/repertorio" className={clasesBotonIcono('borde', 'mt-6 px-4')}>
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
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-6 pb-16">
        <div className="-ml-3 flex items-center gap-1">
          <EnlaceIcono href={`/repertorio/${cantoId}`} etiqueta="Volver al canto">
            <IconoVolver />
          </EnlaceIcono>
          {/* «Historial de cambios» y no «Historial» a secas: ese nombre ya es
              el de la pantalla de qué se canta seguido, en «Más». */}
          <h1 className="titulo-libro min-w-0 text-[1.75rem] leading-tight">Historial de cambios</h1>
        </div>
        <p className="mt-1 text-texto-tenue">{canto.titulo}</p>

        {cambios.length === 0 ? (
          // Un estado vacío explica POR QUÉ está vacío (§14). Y acá dice algo
          // que importa: no es que falte el dato, es que el cifrado es el
          // original tal como se cargó.
          <div className="mt-6">
            <p className="max-w-prose text-texto-tenue">
              Este canto no se editó nunca. El cifrado es el que se cargó la primera vez; cuando
              alguien lo corrija, cada cambio va a quedar acá con quién lo hizo y cuándo.
            </p>
            <Link
              href={`/repertorio/${cantoId}`}
              className={clasesBotonIcono('borde', 'mt-5 px-4')}
            >
              Volver al canto
            </Link>
          </div>
        ) : (
          <>
            <TituloSeccion detalle="del más reciente al más antiguo" className="mt-8">
              {cambios.length === 1 ? '1 cambio' : `${cambios.length} cambios`}
            </TituloSeccion>

            <ol className="mt-2 divide-y divide-borde border-t border-borde">
              {cambios.map((cambio, i) => {
                const lineas = diffLineas(cambio.antes, cambio.despues)
                const sinCambios = lineas.filter((l) => l.tipo === 'igual').length
                const cambiadas = lineas.filter((l) => l.tipo !== 'igual')
                const cuando = cambio.cuando.slice(0, 10)

                return (
                  <li key={cambio.id} className="py-4">
                    <p className="font-semibold">{cambio.descripcion}</p>
                    <p className="mt-0.5 text-sm text-texto-tenue">
                      {/* Sin quién, no se inventa un nombre: se dice qué se sabe. */}
                      {cambio.quien ?? 'Sin identificar'} · {describirAntiguedad(diasEntre(cuando, hoy))}
                    </p>
                    {/* En su propia línea y no como un tercer «· …» colgado
                        del par de arriba: es otro dato, y el que más importa. */}
                    {i === 0 && <p className="text-sm text-texto">Es lo que se canta hoy.</p>}

                    <details className="mt-1 group">
                      <summary className="tactil inline-flex cursor-pointer items-center text-sm text-acento underline underline-offset-2">
                        Ver qué cambió
                      </summary>

                      {/* Solo las líneas que cambiaron: en 360 px, repetir las
                          cuarenta que quedaron iguales esconde justo lo que se
                          vino a mirar. */}
                      <div className="mt-2 overflow-x-auto">
                        {/* Quitada en peligro, agregada en éxito, y además un
                            ícono y un texto para lector: el color solo no
                            alcanza (WCAG 1.4.1). Antes el «+» y el «−» eran
                            glifos, y la agregada iba en el halo escrito a mano. */}
                        <pre className="font-cifrado text-sm leading-relaxed whitespace-pre">
                          {cambiadas.map((l, k) => (
                            <span
                              key={k}
                              className={`block ${l.tipo === 'quitada' ? 'text-peligro' : 'text-exito'}`}
                            >
                              {l.tipo === 'quitada' ? (
                                <IconoQuitar tamano={12} className="mr-1.5 inline align-[-1px]" />
                              ) : (
                                <IconoAgregar tamano={12} className="mr-1.5 inline align-[-1px]" />
                              )}
                              <span className="sr-only">
                                {l.tipo === 'quitada' ? 'Se quitó: ' : 'Se agregó: '}
                              </span>
                              {l.texto || ' '}
                            </span>
                          ))}
                        </pre>
                      </div>
                      {sinCambios > 0 && (
                        <p className="mt-1.5 text-sm text-texto-tenue">
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
