import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

/**
 * El control de 44×44 que la vista de lectura promete en DESIGN.md y no
 * cumplía: el ← medía 23×20, «Editar» 41×16, la píldora «acordes» 60×23.
 *
 * El objetivo es SIEMPRE de 44 px aunque el dibujo sea de 20: lo que se toca es
 * la caja, no el trazo. Y siempre lleva nombre accesible, porque un ícono solo
 * no se anuncia.
 *
 * Cuatro apariencias, por cuánto tiene que pesar en la pantalla:
 *   · `plano`: sin borde, para cabeceras (volver, editar). No compite con el canto.
 *   · `activo`: un `plano` encendido (un interruptor en sí).
 *   · `borde`: con el borde de control a 3:1, para barras de herramientas.
 *   · `lleno`: la acción principal de la pantalla, en el halo.
 */

type Apariencia = 'plano' | 'activo' | 'borde' | 'lleno'

const BASE =
  'tactil inline-flex min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-default'

const APARIENCIA: Record<Apariencia, string> = {
  plano: 'text-texto-tenue hover:bg-superficie hover:text-texto active:bg-superficie-alta',
  // Un interruptor encendido sin borde: superficie y texto pleno, sin color.
  activo: 'bg-superficie-alta text-texto hover:bg-borde',
  borde:
    'border border-borde-fuerte bg-superficie text-texto hover:bg-superficie-alta active:bg-borde disabled:hover:bg-superficie',
  lleno: 'bg-acento font-semibold text-sobre-acento hover:brightness-110 active:brightness-95',
}

export function clasesBotonIcono(apariencia: Apariencia = 'plano', extra = '') {
  return `${BASE} ${APARIENCIA[apariencia]} ${extra}`
}

type Comunes = {
  /** Nombre accesible. Obligatorio: el ícono no habla. */
  etiqueta: string
  apariencia?: Apariencia
  /** Texto visible al lado del ícono, cuando el ícono solo no alcanza. */
  texto?: ReactNode
  children: ReactNode
  className?: string
}

export function BotonIcono({
  etiqueta,
  apariencia = 'plano',
  texto,
  children,
  className = '',
  ...resto
}: Comunes & Omit<ComponentProps<'button'>, 'children' | 'className'>) {
  return (
    <button
      type="button"
      aria-label={texto ? undefined : etiqueta}
      title={texto ? undefined : etiqueta}
      className={clasesBotonIcono(apariencia, `${texto ? 'px-3' : ''} ${className}`)}
      {...resto}
    >
      {children}
      {texto && <span className="text-sm">{texto}</span>}
    </button>
  )
}

export function EnlaceIcono({
  etiqueta,
  apariencia = 'plano',
  texto,
  children,
  className = '',
  ...resto
}: Comunes & Omit<ComponentProps<typeof Link>, 'children' | 'className'>) {
  return (
    <Link
      aria-label={texto ? undefined : etiqueta}
      title={texto ? undefined : etiqueta}
      className={clasesBotonIcono(apariencia, `${texto ? 'px-3' : ''} ${className}`)}
      {...resto}
    >
      {children}
      {texto && <span className="text-sm">{texto}</span>}
    </Link>
  )
}
