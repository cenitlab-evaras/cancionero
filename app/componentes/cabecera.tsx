import Link from 'next/link'
import type { SesionCantoral } from '@/lib/sesion'
import EscudoCoro from './escudo-coro'
import BarraNav from './barra-nav'

/**
 * La cabecera de las pantallas de gestión, y su barra de navegación abajo.
 *
 * Rediseño del 2026-10-17. Antes eran dos filas arriba —identidad y destinos—,
 * con los destinos a 40 px y lejos del pulgar, e Historial y Sugerencias
 * escondidos al pie de un repertorio de 4 700 px. Ahora:
 *
 *   · Arriba, una sola fila de 56 px (`h-14`): de quién es esto. El logo del
 *     coro y su nombre, que también llevan a Inicio. Nada más compite ahí.
 *   · Abajo, la barra fija con cuatro destinos (`barra-nav.tsx`), donde llega
 *     el pulgar.
 *
 * La vista de lectura y la de ejecución NO usan este componente: mientras se
 * toca no hay a dónde ir (DESIGN.md · Layout), y la barra de abajo la ocupa
 * la barra de lectura.
 *
 * Los `sticky` que cuelgan debajo de esta cabecera usan `top-14`: si cambia
 * el alto, cambian con él.
 */
export default function Cabecera({ sesion }: { sesion: SesionCantoral }) {
  const coro = sesion.coroActivo

  return (
    <>
      <header className="sticky top-0 z-(--z-cabecera) border-b border-borde bg-fondo">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-3 px-4">
          {coro ? (
            <Link
              href="/"
              className="-ml-1 flex min-w-0 items-center gap-2.5 rounded-lg py-1 pr-2 pl-1"
            >
              <EscudoCoro coroId={coro.id} nombre={coro.nombre} />
              <span className="titulo-libro truncate text-[1.0625rem]">{coro.nombre}</span>
            </Link>
          ) : (
            <span className="titulo-libro text-[1.0625rem]">Cantoral</span>
          )}
        </div>
      </header>

      <BarraNav sesion={sesion} />
    </>
  )
}
