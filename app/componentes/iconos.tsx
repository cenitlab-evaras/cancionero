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

/** El día, para el campo de fecha de las lecturas: un calendario, no una misa. */
export const IconoCalendario = (p: Props) => (
  <Trazo {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
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

export const IconoListo = (p: Props) => (
  <Trazo {...p}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
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

/** Las cuentas de la instalación: una persona y su lista. */
export const IconoUsuarios = (p: Props) => (
  <Trazo {...p}>
    <circle cx="8" cy="8" r="3.2" />
    <path d="M2.5 19.5c.5-3.2 2.7-5.2 5.5-5.2s5 2 5.5 5.2" />
    <path d="M15 7h6M15 11h6M15 15h4" />
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

/** El tema (2026-10-17): el sol lleva al claro, la luna al oscuro. */
export const IconoSol = (p: Props) => (
  <Trazo {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
  </Trazo>
)

export const IconoLuna = (p: Props) => (
  <Trazo {...p}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />
  </Trazo>
)

/** Desplegar: apunta abajo cerrado; se gira 180° abierto (2026-10-17). */
export const IconoDesplegar = (p: Props) => (
  <Trazo {...p}>
    <path d="m6 9 6 6 6-6" />
  </Trazo>
)

/**
 * El asa para arrastrar un canto (⋮⋮, 2026-10-17): seis puntos en dos columnas.
 * Los puntos son trazos de largo cero con la punta redonda, un poco más gruesos
 * que el resto para que se vean como puntos y no como polvo.
 */
export const IconoAgarrar = (p: Props) => (
  <Trazo {...p}>
    <path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" strokeWidth={2.75} />
  </Trazo>
)

/** Un diapasón: «Dar el tono» (herramienta, 2026-10-17). */
export const IconoDiapason = (p: Props) => (
  <Trazo {...p}>
    <path d="M8.5 3v7a3.5 3.5 0 0 0 7 0V3" />
    <path d="M12 13.5V21" />
  </Trazo>
)

// -----------------------------------------------------------------------------
// H31 · El contexto de la misa (rediseño de lectura, 2026-11-23)
// -----------------------------------------------------------------------------

/** El coro que canta: un grupo, no una sola persona. */
export const IconoCoro = (p: Props) => (
  <Trazo {...p}>
    <circle cx="9" cy="8" r="3" />
    <path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
    <circle cx="17" cy="9" r="2.5" />
    <path d="M14 20a4.5 4.5 0 0 1 6.5-4" />
  </Trazo>
)

/**
 * La complejidad de la misa: una, dos o tres barras encendidas.
 *
 * El nivel no es un dato que se guarde: se calcula al leer. La barra que no
 * llega al nivel queda dibujada con el trazo de siempre, sin relleno, para que
 * se vea que la escala es de tres.
 */
export const IconoComplejidad = ({
  nivel,
  ...p
}: Props & { nivel: 'baja' | 'media' | 'alta' }) => {
  const cuantas = nivel === 'alta' ? 3 : nivel === 'media' ? 2 : 1
  return (
    <Trazo {...p}>
      <rect x="4" y="14" width="3.5" height="6" rx="1" fill={cuantas >= 1 ? 'currentColor' : 'none'} />
      <rect x="10.25" y="10" width="3.5" height="10" rx="1" fill={cuantas >= 2 ? 'currentColor' : 'none'} />
      <rect x="16.5" y="6" width="3.5" height="14" rx="1" fill={cuantas >= 3 ? 'currentColor' : 'none'} />
    </Trazo>
  )
}

/** La celebración litúrgica: una estrella, sin cruces ni símbolos. */
export const IconoCelebracion = (p: Props) => (
  <Trazo {...p}>
    <path d="m12 3 2.7 5.5 6 .9-4.4 4.3 1 6-5.3-2.8-5.3 2.8 1-6L3.3 9.4l6-.9Z" />
  </Trazo>
)

/** El lugar: un pin de mapa. */
export const IconoLugar = (p: Props) => (
  <Trazo {...p}>
    <path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </Trazo>
)

/** La lista de los cantos de la misa: renglones con viñeta. */
export const IconoLista = (p: Props) => (
  <Trazo {...p}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </Trazo>
)

/** La ayuda: un signo de pregunta en su círculo. */
export const IconoAyuda = (p: Props) => (
  <Trazo {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9a2.5 2.5 0 1 1 4.2 1.8c-.9.7-1.7 1.1-1.7 2.2M12 17h.01" />
  </Trazo>
)

/** «Quién canta cada estrofa»: una persona y la franja de la estrofa. */
export const IconoQuienCanta = (p: Props) => (
  <Trazo {...p}>
    <circle cx="8.5" cy="8" r="2.5" />
    <path d="M4 19c0-2.8 2-4.6 4.5-4.6S13 16.2 13 19" />
    <path d="M16.5 6.5v11M20 9.5v5" />
  </Trazo>
)

/** «Resaltar mi cuerda»: un marcador de texto. */
export const IconoResaltarCuerda = (p: Props) => (
  <Trazo {...p}>
    <path d="M5 19.5 9 18l8.5-8.5a2.1 2.1 0 0 0-3-3L6 15l-1 4.5Z" />
    <path d="m13.5 6.5 3 3" />
  </Trazo>
)

/** «Dar el tono»: el diapasón. */
export const IconoDarTono = (p: Props) => (
  <Trazo {...p}>
    <path d="M8 4v6a4 4 0 0 0 8 0V4" />
    <path d="M12 14v6M9 20h6" />
  </Trazo>
)

/** «Acordes en Do-Re-Mi»: dos notas. */
export const IconoAcordesLatinos = (p: Props) => (
  <Trazo {...p}>
    <circle cx="7" cy="17.5" r="2.5" />
    <circle cx="17" cy="15.5" r="2.5" />
    <path d="M9.5 17.5V7l10-2v10.5" />
  </Trazo>
)
