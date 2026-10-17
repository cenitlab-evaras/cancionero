import type { SVGProps } from 'react'

/**
 * Los íconos de Cantoral, dibujados. Un solo estilo: trazo de 1,75 sobre una
 * grilla de 24, puntas redondas, sin relleno salvo reproducir y pausar.
 *
 * No son glifos de texto (← ✕ + ✎): esos cambian de forma y de tamaño según la
 * fuente del sistema, y un ← de 16 px no llega a ser un objetivo táctil.
 *
 * Sin cruces ni símbolos religiosos decorativos (PRODUCT.md · anti-referencias):
 * la misa se dibuja como lo que es en la app, una fecha.
 */

type Props = SVGProps<SVGSVGElement> & { tamano?: number }

function Trazo({ tamano = 22, children, ...resto }: Props & { children: React.ReactNode }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      focusable="false"
      {...resto}
    >
      {children}
    </svg>
  )
}

export const IconoInicio = (p: Props) => (
  <Trazo {...p}>
    <path d="M3.5 10.5 12 3.5l8.5 7" />
    <path d="M5.5 9v10.5h4.5V14h4v5.5h4.5V9" />
  </Trazo>
)

/** El cancionero: un libro abierto. */
export const IconoRepertorio = (p: Props) => (
  <Trazo {...p}>
    <path d="M12 6.5C10.3 5 7.8 4.5 4 4.5v14c3.8 0 6.3.5 8 2 1.7-1.5 4.2-2 8-2v-14c-3.8 0-6.3.5-8 2Z" />
    <path d="M12 6.5v14" />
  </Trazo>
)

/** La misa: una fecha. */
export const IconoMisas = (p: Props) => (
  <Trazo {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
    <path d="M8 14h3" />
  </Trazo>
)

export const IconoMas = (p: Props) => (
  <Trazo {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Trazo>
)

export const IconoVolver = (p: Props) => (
  <Trazo {...p}>
    <path d="M15 5l-7 7 7 7" />
  </Trazo>
)

export const IconoSeguir = (p: Props) => (
  <Trazo {...p}>
    <path d="M9 5l7 7-7 7" />
  </Trazo>
)

export const IconoCerrar = (p: Props) => (
  <Trazo {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Trazo>
)

export const IconoAgregar = (p: Props) => (
  <Trazo {...p}>
    <path d="M12 5v14M5 12h14" />
  </Trazo>
)

export const IconoQuitar = (p: Props) => (
  <Trazo {...p}>
    <path d="M5 12h14" />
  </Trazo>
)

export const IconoSubir = (p: Props) => (
  <Trazo {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Trazo>
)

export const IconoBajar = (p: Props) => (
  <Trazo {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Trazo>
)

export const IconoEditar = (p: Props) => (
  <Trazo {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16v4Z" />
    <path d="M13.5 6.5l4 4" />
  </Trazo>
)

export const IconoBuscar = (p: Props) => (
  <Trazo {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </Trazo>
)

export const IconoHistorial = (p: Props) => (
  <Trazo {...p}>
    <path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5" />
    <path d="M4 4v4.5h4.5" />
    <path d="M12 8v4.5l3 2" />
  </Trazo>
)

/** Sugerencias: una mano levantada sería literal; una nota con signo de más es el gesto. */
export const IconoSugerencias = (p: Props) => (
  <Trazo {...p}>
    <path d="M5 4.5h14v11H10l-5 4v-15Z" />
    <path d="M12 7.5v5M9.5 10h5" />
  </Trazo>
)

export const IconoMiembros = (p: Props) => (
  <Trazo {...p}>
    <circle cx="9" cy="8.5" r="3.5" />
    <path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" />
    <path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.8c2.2.6 3.6 2.4 4 5.2" />
  </Trazo>
)

export const IconoPerfil = (p: Props) => (
  <Trazo {...p}>
    <circle cx="12" cy="8.5" r="4" />
    <path d="M4.5 20.5c.8-4 3.8-6.5 7.5-6.5s6.7 2.5 7.5 6.5" />
  </Trazo>
)

export const IconoCambiar = (p: Props) => (
  <Trazo {...p}>
    <path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" />
  </Trazo>
)

export const IconoSalir = (p: Props) => (
  <Trazo {...p}>
    <path d="M14 4.5H6.5a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2H14" />
    <path d="M10.5 12H20M16.5 8.5 20 12l-3.5 3.5" />
  </Trazo>
)

export const IconoArchivo = (p: Props) => (
  <Trazo {...p}>
    <rect x="3.5" y="4.5" width="17" height="4.5" rx="1" />
    <path d="M5 9v9.5a1.5 1.5 0 0 0 1.5 1.5h11a1.5 1.5 0 0 0 1.5-1.5V9M10 13h4" />
  </Trazo>
)

export const IconoAdmin = (p: Props) => (
  <Trazo {...p}>
    <path d="M12 3.5 5 6v5.5c0 4.3 3 7.6 7 9 4-1.4 7-4.7 7-9V6l-7-2.5Z" />
    <path d="M9 12l2 2 4-4" />
  </Trazo>
)

/** Reproducir y pausar van rellenos: a 14 px un triángulo de trazo se lee como flecha. */
export const IconoReproducir = ({ tamano = 18, ...p }: Props) => (
  <svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false" {...p}>
    <path d="M7 4.8v14.4a1.2 1.2 0 0 0 1.8 1L20 13a1.2 1.2 0 0 0 0-2L8.8 3.8A1.2 1.2 0 0 0 7 4.8Z" />
  </svg>
)

export const IconoPausa = ({ tamano = 18, ...p }: Props) => (
  <svg width={tamano} height={tamano} viewBox="0 0 24 24" fill="currentColor" aria-hidden focusable="false" {...p}>
    <rect x="5.5" y="4" width="4.5" height="16" rx="1.2" />
    <rect x="14" y="4" width="4.5" height="16" rx="1.2" />
  </svg>
)

/** Ver acordes: una nota sobre una línea, como un acorde sobre su sílaba. */
export const IconoAcordes = (p: Props) => (
  <Trazo {...p}>
    <path d="M9 17V5.5l10-2V15" />
    <circle cx="6.5" cy="17" r="2.5" />
    <circle cx="16.5" cy="15" r="2.5" />
  </Trazo>
)

/** H23 · Repetir: en Taizé el coro repite mientras el solista canta. */
export const IconoRepetir = (p: Props) => (
  <Trazo {...p}>
    <path d="M17 3l3 3-3 3" />
    <path d="M4 11V9a3 3 0 0 1 3-3h13" />
    <path d="M7 21l-3-3 3-3" />
    <path d="M20 13v2a3 3 0 0 1-3 3H4" />
  </Trazo>
)

/** H23 · Mezcla: tres perillas, una por línea. */
export const IconoMezcla = (p: Props) => (
  <Trazo {...p}>
    <path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" />
    <circle cx="15" cy="6" r="2" />
    <circle cx="9" cy="12" r="2" />
    <circle cx="17" cy="18" r="2" />
  </Trazo>
)
