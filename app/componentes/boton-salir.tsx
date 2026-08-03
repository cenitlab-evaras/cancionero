'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function BotonSalir() {
  const router = useRouter()

  async function salir() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/entrar')
    router.refresh()
  }

  return (
    <button
      onClick={salir}
      className="rounded-lg px-2 py-2 text-xs text-texto-tenue transition-colors hover:text-texto"
    >
      Salir
    </button>
  )
}
