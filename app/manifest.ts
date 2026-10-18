import type { MetadataRoute } from 'next'
import { COLOR_BARRA } from './componentes/tema'

/**
 * Para «Agregar a pantalla de inicio» (el dueño, 2026-10-17: «quiero ver el
 * logo en mi celular con la app»). Android lee los íconos de acá; el iPhone usa
 * `apple-icon.png`, que Next enlaza solo.
 *
 * El ícono es el logo del coro San José de la Familia, el único que usa la app
 * hoy. Cuando haya más coros con su logo (Storage, PRD §21), el ícono tendrá que
 * ser el de Cantoral o salir del coro activo.
 *
 * Se abre sin la barra del navegador y en el color del tema oscuro, que es el
 * de partida (`layout.tsx`).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cantoral',
    short_name: 'Cantoral',
    description: 'El repertorio de tu coro, en tu teléfono.',
    lang: 'es',
    start_url: '/',
    display: 'standalone',
    background_color: COLOR_BARRA.oscuro,
    theme_color: COLOR_BARRA.oscuro,
    icons: [
      { src: '/iconos/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/iconos/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // El logo llega al borde y las caras van al centro: Android puede
      // recortarlo en círculo o en gota sin cortar a nadie.
      { src: '/iconos/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
