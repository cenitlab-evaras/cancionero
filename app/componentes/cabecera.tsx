import Link from 'next/link'
import type { SesionCantoral } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import BotonSalir from './boton-salir'
import SelectorCoro from './selector-coro'
import NavDestinos, { type Destino } from './nav-destinos'

/**
 * Cabecera de las pantallas de gestión, en DOS filas.
 *
 * Arriba, quién sos y dónde estás: Cantoral, el coro activo y la salida.
 * Abajo, a dónde podés ir.
 *
 * POR QUÉ DOS FILAS Y NO UNA:
 *   En una sola fila, a 360 px y con el director, los cinco elementos ocupaban
 *   344 px con TRES separaciones de 4 px entre destinos táctiles. Y alguien que
 *   además fuera admin sumaba «Admin» y desbordaba. La causa no eran los
 *   destinos: eran «Cantoral» y el nombre del coro, que se llevaban 81 px sin
 *   ser un lugar a donde ir.
 *
 *   Separándolos, los destinos tienen la fila entera y el nombre del coro deja
 *   de competir con ellos. Cuesta 16 px de alto, y solo acá: la vista de
 *   lectura no lleva esta cabecera (§DESIGN «no hay a dónde navegar mientras se
 *   toca»).
 *
 * Cada destino se muestra solo a quien la matriz deja usarlo: ofrecer una
 * pantalla que va a rechazarlo es mala interfaz. La seguridad no la decide
 * esto, la deciden la RLS y la action (§8.3).
 */
export default function Cabecera({ sesion }: { sesion: SesionCantoral }) {
  const destinos: Destino[] = []

  if (sesion.coroActivo) {
    destinos.push({ href: '/repertorio', texto: 'Repertorio' })
    destinos.push({ href: '/celebraciones', texto: 'Misas' })
    if (puede(sesion.sujeto, 'ver_ficha_del_coro')) {
      destinos.push({ href: '/coro/miembros', texto: 'Miembros' })
    }
    destinos.push({ href: '/historial', texto: 'Historial' })
    if (puede(sesion.sujeto, 'editar_ficha_propia')) {
      destinos.push({ href: '/mi-ficha', texto: 'Mi ficha' })
    }
  }
  if (puede(sesion.sujeto, 'aprobar_perfil')) {
    destinos.push({ href: '/admin/perfiles', texto: 'Admin' })
  }

  return (
    <header className="sticky top-0 z-(--z-cabecera) border-b border-borde bg-fondo/95 backdrop-blur">
      <div className="mx-auto w-full max-w-2xl px-4">
        {/* Fila 1 · identidad y contexto. Nada de esto es un destino. */}
        <div className="flex h-9 items-center justify-between gap-3">
          <Link href="/repertorio" className="flex min-w-0 items-baseline gap-2">
            <span className="font-cifrado text-sm font-bold tracking-tight">Cantoral</span>
            {/* Con un solo coro el nombre informa dónde estás; con varios, el
                selector lo reemplaza y además deja cambiarlo. */}
            {sesion.coroActivo && sesion.coros.length === 1 && (
              <span className="truncate text-xs text-texto-tenue">{sesion.coroActivo.nombre}</span>
            )}
          </Link>

          <div className="flex shrink-0 items-center gap-1">
            {sesion.coros.length > 1 && (
              <SelectorCoro coros={sesion.coros} activoId={sesion.coroActivo?.id ?? ''} />
            )}
            <BotonSalir />
          </div>
        </div>

        {/* Fila 2 · a dónde ir. Se calla cuando no hay a dónde. */}
        {destinos.length > 0 && (
          <div className="pb-1.5">
            <NavDestinos destinos={destinos} />
          </div>
        )}
      </div>
    </header>
  )
}
