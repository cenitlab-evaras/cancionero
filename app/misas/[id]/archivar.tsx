'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { archivarMisa } from '../acciones'
import TituloSeccion from '@/app/componentes/titulo-seccion'
import { clasesBotonIcono } from '@/app/componentes/boton-icono'
import { IconoArchivo } from '@/app/componentes/iconos'

/**
 * Archivar una misa que ya pasó (2026-11-23).
 *
 * La lista de Misas era el único lugar donde se archivaba, con el gesto de
 * deslizar y confirmar. Ahora es un calendario y la salida vive en la pantalla
 * de la misa: el director la abre desde su día y la archiva desde acá.
 *
 * La confirmación es explícita y en dos pasos, como al archivar un canto: la
 * misa sale del calendario y del Inicio, aunque la fila queda en la base como
 * respaldo y sus cantos se conservan. El botón que confirma va en el color de
 * peligro sin relleno — avisa, pero no promete un borrado que no ocurre.
 */
export default function ArchivarMisa({ misaId }: { misaId: string }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()

  function archivar() {
    setError(null)
    empezar(async () => {
      const r = await archivarMisa(misaId)
      if (!r.ok) {
        setError(r.error)
        return
      }
      router.push('/misas')
      router.refresh()
    })
  }

  return (
    <section className="mt-10 border-t border-borde pt-6">
      <TituloSeccion>Esta misa ya pasó</TituloSeccion>

      {!confirmando ? (
        <>
          <p className="mt-1 max-w-prose text-sm text-texto-tenue">
            Al archivarla sale del calendario de Misas y queda guardada como respaldo.
          </p>
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className={clasesBotonIcono('borde', 'mt-3 px-4')}
          >
            <IconoArchivo tamano={18} />
            <span className="text-sm">Archivar misa</span>
          </button>
        </>
      ) : (
        <div
          role="alertdialog"
          aria-labelledby="confirmar-archivar-misa"
          className="mt-3 rounded-lg border border-borde-fuerte bg-superficie p-3"
        >
          <h3 id="confirmar-archivar-misa" className="text-base font-semibold">
            ¿Archivar esta misa?
          </h3>
          <p className="mt-1 max-w-prose text-sm text-texto-tenue">
            Sale del calendario y del Inicio. La misa y sus cantos no se borran: quedan
            guardados como respaldo.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={archivar}
              disabled={pendiente}
              className={clasesBotonIcono(
                'borde',
                'px-4 font-semibold !border-peligro !text-peligro'
              )}
            >
              {pendiente ? 'Archivando…' : 'Archivar'}
            </button>
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              disabled={pendiente}
              className={clasesBotonIcono('plano', 'px-4')}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-peligro">
          {error}
        </p>
      )}
    </section>
  )
}
