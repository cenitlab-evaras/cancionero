'use client'

import { useEffect } from 'react'

/**
 * Mantiene la pantalla encendida mientras se lee un canto.
 *
 * Sin esto el teléfono se apagaba solo a mitad del canto —a los 30 segundos en
 * muchos iPhone— y había que desbloquearlo con la púa en la mano. El navegador
 * suelta el bloqueo cuando la pestaña se oculta, así que se vuelve a pedir al
 * volver a ella.
 *
 * Si el navegador no lo soporta o lo niega (ahorro de batería), no pasa nada:
 * la app sigue funcionando igual que antes. No se le avisa a nadie de algo que
 * no puede arreglar.
 */
export default function PantallaEncendida() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return

    let bloqueo: WakeLockSentinel | null = null
    let activo = true

    async function pedir() {
      if (document.visibilityState !== 'visible') return
      try {
        bloqueo = await navigator.wakeLock.request('screen')
        if (!activo) await bloqueo.release()
      } catch {
        // Denegado o no disponible: se sigue sin él.
      }
    }

    function alVolver() {
      if (document.visibilityState === 'visible') pedir()
    }

    pedir()
    document.addEventListener('visibilitychange', alVolver)

    return () => {
      activo = false
      document.removeEventListener('visibilitychange', alVolver)
      bloqueo?.release().catch(() => {})
    }
  }, [])

  return null
}
