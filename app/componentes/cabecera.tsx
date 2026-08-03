import Link from 'next/link'
import type { SesionCantoral } from '@/lib/sesion'
import BotonSalir from './boton-salir'
import SelectorCoro from './selector-coro'

/**
 * Cabecera fija, angosta. No hay navegación que ofrecer mientras se toca: solo
 * el nombre del coro activo y la salida.
 *
 * El selector de coro solo aparece si la persona pertenece a más de uno
 * (PRD §18-3). Con un solo coro se elige solo y no estorba.
 */
export default function Cabecera({ sesion }: { sesion: SesionCantoral }) {
  return (
    <header className="sticky top-0 z-(--z-cabecera) h-14 border-b border-borde bg-fondo/95 backdrop-blur">
      <div className="mx-auto flex h-full w-full max-w-2xl items-center justify-between gap-3 px-4">
        <Link href="/repertorio" className="flex min-w-0 items-baseline gap-2">
          <span className="font-cifrado text-sm font-bold tracking-tight">Cantoral</span>
          {sesion.coroActivo && (
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
    </header>
  )
}
