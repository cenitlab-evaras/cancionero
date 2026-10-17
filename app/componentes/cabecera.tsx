import Link from 'next/link'
import type { SesionCantoral } from '@/lib/sesion'
import { nombreDelRol } from '@/lib/permisos'
import EscudoCoro from './escudo-coro'
import BarraNav from './barra-nav'
import BuscadorGlobal from './buscador-global'
import ConmutadorTema from './conmutador-tema'

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
 *
 * Desde el 2026-10-17, a pedido del dueño, la fila fija suma a la derecha el
 * ROL con que se está mirando («Director», «Miembro»…): había quedado como
 * `ajeno@` sin saberlo y una pantalla vacía parecía una falla. Y debajo, fuera
 * de la parte fija, una barra para buscar un canto desde cualquier pantalla,
 * con los resultados apareciendo mientras se escribe (`buscador-global.tsx`).
 * El repertorio la apaga (`buscador`) porque ya tiene la suya, fija bajo esta
 * fila.
 */
export default function Cabecera({
  sesion,
  buscador = true,
}: {
  sesion: SesionCantoral
  buscador?: boolean
}) {
  const coro = sesion.coroActivo
  const rol = nombreDelRol(sesion.sujeto)

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

          <ConmutadorTema className="ml-auto" />
          <Link
            href="/mas"
            title={`Entraste como ${sesion.email}`}
            aria-label={`Entraste como ${rol}, ${sesion.email}. Ver tu cuenta`}
            className="tactil flex shrink-0 items-center rounded-lg border border-borde-fuerte px-2.5 text-sm text-texto-tenue transition-colors hover:text-texto"
          >
            {rol}
          </Link>
        </div>
      </header>

      {buscador && sesion.coroActivo && <BuscadorGlobal />}

      <BarraNav sesion={sesion} />
    </>
  )
}
