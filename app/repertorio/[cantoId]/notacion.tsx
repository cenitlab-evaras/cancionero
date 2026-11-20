'use client'

import { useRouter } from 'next/navigation'
import { useOptimistic, useTransition } from 'react'
import { guardarHerramienta } from '@/app/herramientas/acciones'
import { clasesBotonIcono } from '@/app/componentes/boton-icono'

/**
 * El interruptor Do-Re-Mi en la lectura (el dueño, 2026-11-20: «no veo que
 * aquí se vaya a cambiar de clave americana a clave normal»). Es la misma
 * herramienta de «Mi perfil» —`notacion_latina`—, puesta donde se necesita:
 * con el canto abierto, al lado del resto de los controles de lectura.
 *
 * Sigue la forma de un interruptor: `aria-pressed` dice si está prendido y el
 * nombre dice QUÉ se prende, no la acción.
 */
export default function Notacion({ latina }: { latina: boolean }) {
  const router = useRouter()
  const [, iniciar] = useTransition()
  const [optimista, aplicar] = useOptimistic(latina)

  function alternar() {
    iniciar(async () => {
      aplicar(!optimista)
      await guardarHerramienta({ herramienta: 'notacion_latina', prender: !optimista })
      router.refresh()
    })
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={optimista}
      aria-label="Acordes en Do-Re-Mi"
      title={optimista ? 'Volver a la notación americana (C, D, E)' : 'Ver los acordes en Do-Re-Mi (Do, Re, Mi)'}
      className={clasesBotonIcono(optimista ? 'activo' : 'plano', 'gap-1 px-2')}
    >
      <span className="font-cifrado text-sm font-bold">{optimista ? 'Do·Re·Mi' : 'C·D·E'}</span>
    </button>
  )
}
