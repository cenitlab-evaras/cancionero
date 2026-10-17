'use client'

import { clasesBotonIcono } from './boton-icono'
import { IconoLuna, IconoSol } from './iconos'
import { COLOR_BARRA, COOKIE_TEMA, type Tema } from './tema'

/**
 * El sol y la luna: cambia entre el tema oscuro y el claro.
 *
 * No tiene estado de React: el tema vive en `<html data-tema>` (lo pone el
 * layout desde la cookie) y el CSS muestra el ícono que toca —el sol en el
 * oscuro, la luna en el claro—. Así el servidor y el cliente dibujan lo mismo
 * y el cambio es inmediato, sin volver a pedir la página.
 */
export default function ConmutadorTema({ className = '' }: { className?: string }) {
  function cambiar() {
    const html = document.documentElement
    const nuevo: Tema = html.dataset.tema === 'claro' ? 'oscuro' : 'claro'
    html.dataset.tema = nuevo
    document.cookie = `${COOKIE_TEMA}=${nuevo}; path=/; max-age=31536000; samesite=lax`
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', COLOR_BARRA[nuevo])
  }

  return (
    <button type="button" onClick={cambiar} className={clasesBotonIcono('plano', className)}>
      <span className="contents claro:hidden">
        <IconoSol />
        <span className="sr-only">Cambiar al tema claro</span>
      </span>
      <span className="hidden claro:contents">
        <IconoLuna />
        <span className="sr-only">Cambiar al tema oscuro</span>
      </span>
    </button>
  )
}
