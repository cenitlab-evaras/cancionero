import type { SesionCantoral } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { IconoInicio, IconoMas, IconoMisas, IconoRepertorio } from './iconos'
import DestinosNav, { type DestinoNav } from './destinos-nav'

/**
 * La barra de navegación de abajo: cuatro destinos con ícono y texto.
 *
 * PRODUCT.md tenía «pestañas abajo» entre las anti-referencias, por OpenChord:
 * Material genérico, acento rojo, sombras. El dueño la pidió el 2026-10-17 por
 * lo que el producto ya decía de sí mismo —«diseñar para la mano ocupada»—, y
 * lo que se evita ahora es aquel ESTILO, no la posición: sin sombra, sin
 * elevación, sin color salvo el lugar activo, y con texto siempre visible.
 *
 * Cuatro y no más (≤4 opciones por decisión). Lo que no entra vive en «Más».
 * La seguridad no la decide esto: la deciden la RLS y cada action (§8.3).
 */
export default function BarraNav({ sesion }: { sesion: SesionCantoral }) {
  const destinos: DestinoNav[] = []

  if (sesion.coroActivo && puede(sesion.sujeto, 'ver_repertorio')) {
    destinos.push({ href: '/', texto: 'Inicio', icono: <IconoInicio />, exacto: true })
    destinos.push({ href: '/repertorio', texto: 'Repertorio', icono: <IconoRepertorio /> })
    destinos.push({ href: '/misas', texto: 'Misas', icono: <IconoMisas /> })
  }
  destinos.push({
    href: '/mas',
    texto: 'Más',
    icono: <IconoMas />,
    // «Más» queda activo en todo lo que se alcanza desde ahí: si no, en
    // /historial ninguna pestaña dice dónde estás (lo marcó la crítica).
    tambien: ['/historial', '/sugerencias', '/coro', '/mi-perfil', '/admin', '/coros'],
  })

  return <DestinosNav destinos={destinos} />
}
