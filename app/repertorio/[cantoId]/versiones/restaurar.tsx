'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { restaurarVersion } from './acciones'
import { clasesBotonIcono } from '@/app/componentes/boton-icono'

/**
 * Volver a una versión anterior (H19-A).
 *
 * LA CONFIRMACIÓN DICE QUE NO SE PIERDE NADA, y eso no es un consuelo: es cómo
 * funciona. Restaurar es una edición más, así que el cifrado que está ahora
 * queda guardado como una versión y se puede volver a él. Sin decirlo, el
 * director duda justo cuando debería usarlo.
 *
 * Por eso tampoco usa el color de peligro (§11.1): pintarlo de rojo prometería
 * una destrucción que no ocurre. Confirmar es la acción principal de este
 * paso y va en el halo, con el texto en el color del fondo: el `text-white`
 * de antes daba 1,6:1 sobre el halo.
 */
export default function Restaurar({
  cantoId,
  versionId,
  descripcion,
}: {
  cantoId: string
  versionId: string
  descripcion: string
}) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()

  function restaurar() {
    setError(null)
    empezar(async () => {
      const r = await restaurarVersion(cantoId, versionId)
      if (!r.ok) {
        setError(r.error)
        return
      }
      router.push(`/repertorio/${cantoId}`)
      router.refresh()
    })
  }

  return (
    <div className="mt-3 border-t border-borde pt-3">
      {!confirmando ? (
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className={clasesBotonIcono('borde', 'px-4')}
        >
          Volver a esta versión
        </button>
      ) : (
        <>
          <p className="max-w-prose text-sm">
            El cifrado del canto vuelve a como estaba antes de «{descripcion.toLowerCase()}». Lo que
            está ahora <strong className="font-medium">no se pierde</strong>: queda guardado como
            una versión más y puedes volver a él.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={restaurar}
              disabled={pendiente}
              className={clasesBotonIcono('lleno', 'px-4')}
            >
              {pendiente ? 'Volviendo…' : 'Sí, volver'}
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
        </>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-peligro">
          {error}
        </p>
      )}
    </div>
  )
}
