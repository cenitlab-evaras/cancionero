'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type Destino = { href: string; texto: string }

/**
 * La segunda fila de la cabecera: a dónde puede ir esta persona.
 *
 * Va separada de la primera porque el nombre del coro y la salida no son
 * destinos, y mezclarlos dejaba tres separaciones de 4 px entre cosas que se
 * tocan con el pulgar (medido a 360 px con el director: 344 de 360 px usados).
 *
 * Es un componente de cliente por una sola razón: marcar dónde estás parado.
 * Un menú que no dice en qué pantalla estás obliga a leer el título para
 * saberlo.
 *
 * `overflow-x-auto` en vez de esconder destinos tras un «⋯»: si mañana aparece
 * otro, entra desplazándose y no hay que decidir cuál se oculta. El scroll es
 * de esta fila, no de la página — el ancho del documento sigue siendo 360.
 */
export default function NavDestinos({ destinos }: { destinos: Destino[] }) {
  const aqui = usePathname()

  return (
    <nav
      aria-label="Secciones"
      className="-mx-1 flex items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {destinos.map(({ href, texto }) => {
        // `/repertorio` no debe quedar activo dentro de `/repertorio/nuevo`:
        // se compara el segmento, no el prefijo suelto.
        const activo = aqui === href || aqui.startsWith(href + '/')

        return (
          <Link
            key={href}
            href={href}
            aria-current={activo ? 'page' : undefined}
            className={`shrink-0 rounded-md px-2 py-2.5 text-[0.8125rem] whitespace-nowrap transition-colors ${
              activo
                ? 'bg-superficie-alta text-texto'
                : 'text-texto-tenue hover:text-texto'
            }`}
          >
            {texto}
          </Link>
        )
      })}
    </nav>
  )
}
