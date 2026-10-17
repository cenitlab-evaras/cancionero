'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { IconoSalir } from './iconos'

/**
 * Salir de ESTE teléfono.
 *
 * `scope: 'local'` a propósito: el `signOut()` por defecto es global y cerraba
 * la sesión en todos los dispositivos de la persona —el computador del ensayo,
 * la tableta del atril— por haber tocado «Salir» en el teléfono.
 *
 * Vive en «Más» y no en la cabecera: estaba a un toque en plena misa.
 */
export default function BotonSalir() {
  const router = useRouter()
  const [saliendo, setSaliendo] = useState(false)

  async function salir() {
    setSaliendo(true)
    const supabase = createClient()
    await supabase.auth.signOut({ scope: 'local' })
    router.replace('/entrar')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={salir}
      disabled={saliendo}
      className="tactil flex w-full items-center gap-4 rounded-lg px-3 text-left text-texto-tenue transition-colors hover:bg-superficie hover:text-texto disabled:opacity-40"
    >
      <IconoSalir />
      <span className="flex-1">{saliendo ? 'Saliendo…' : 'Salir de este teléfono'}</span>
    </button>
  )
}
