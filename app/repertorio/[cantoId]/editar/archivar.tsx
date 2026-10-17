'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { archivarCanto } from '../../acciones'
import TituloSeccion from '@/app/componentes/titulo-seccion'
import { clasesBotonIcono } from '@/app/componentes/boton-icono'

/**
 * Sacar un canto de circulación (§16, cerrado el 2026-09-03).
 *
 * NO es un borrado y la pantalla lo dice, no lo insinúa: el canto sale del
 * repertorio y de la búsqueda, pero sigue en las misas donde ya se cantó y en
 * el historial. Por eso el botón que confirma lleva el color de peligro en el
 * texto y el borde, pero sin relleno (rediseño 2026-10-17): avisa que el canto sale de la
 * lista, pero un botón rojo lleno prometería una destrucción que no ocurre. El
 * primer paso, que solo abre la confirmación, sigue siendo un control normal.
 * Y nunca `text-white` sobre el halo: daba 1,6:1. Los `!` hacen falta porque
 * `borde` ya trae su color de borde y de texto, y entre dos utilidades de la
 * misma propiedad Tailwind no garantiza cuál gana.
 *
 * La confirmación es de dos pasos y **dice en cuántas misas aparece**. Un
 * «¿seguro?» pelado no informa nada: el número es justamente lo que hace que el
 * director decida distinto ante un canto que se cantó cuatro veces y uno que
 * cargó por error el martes.
 */
export default function Archivar({
  cantoId,
  enMisas,
}: {
  cantoId: string
  /** En cuántas misas aparece. Se calcula al leer, nunca se guarda. */
  enMisas: number
}) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()

  function archivar() {
    setError(null)
    empezar(async () => {
      const r = await archivarCanto(cantoId)
      if (!r.ok) {
        setError(r.error)
        return
      }
      router.push('/repertorio')
      router.refresh()
    })
  }

  return (
    <section className="mt-10 border-t border-borde pt-6 pb-10">
      <TituloSeccion>Sacar del repertorio</TituloSeccion>

      {!confirmando ? (
        <>
          <p className="mt-2 max-w-prose text-sm text-texto-tenue">
            Archivarlo lo saca del listado y de la búsqueda. No lo borra: sigue en las misas donde
            ya se cantó y en el historial, y puedes traerlo de vuelta cuando quieras.
          </p>
          <button
            type="button"
            onClick={() => setConfirmando(true)}
            className={clasesBotonIcono('borde', 'mt-3 px-4')}
          >
            Archivar este canto
          </button>
        </>
      ) : (
        <div className="mt-2">
          <p className="max-w-prose text-sm">
            {enMisas === 0
              ? 'Este canto no está en ninguna misa.'
              : enMisas === 1
                ? 'Este canto está en 1 misa. Va a seguir apareciendo ahí y en el historial.'
                : `Este canto está en ${enMisas} misas. Va a seguir apareciendo ahí y en el historial.`}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={archivar}
              disabled={pendiente}
              className={clasesBotonIcono('borde', 'px-4 font-semibold !border-peligro !text-peligro')}
            >
              {pendiente ? 'Archivando…' : 'Sí, archivar'}
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
