/**
 * El estado de un canto dentro del coro — H10, docs/PRD.md §5 y §17.
 *
 * Función PURA y sin datos: la comparten el listado, la vista de lectura, el
 * formulario y la server action, para que el texto que se ve y la regla que se
 * aplica no puedan divergir.
 *
 * Esto NO es seguridad. Quién puede cambiar el estado lo decide `permisos.ts`
 * (capacidad `editar_canto`) y lo hace cumplir la RLS (`cantos_write`, que ya
 * era `es_director_de` desde H1). Acá solo vive qué es un estado válido y cómo
 * se lee.
 */

/**
 * Los dos estados, decididos el 2026-08-07.
 *
 * `archivado` quedó fuera a propósito, y §17 declara la consecuencia: el
 * borrado de §16 sigue sin resolverse. Cuando entre, se agrega acá y en el
 * `check` de la migración — el test de `esEstadoValido` se pone rojo solo.
 */
export const ESTADOS = ['en_ensayo', 'listo'] as const
export type EstadoCanto = (typeof ESTADOS)[number]

/** El default, y el mismo que el de la columna: `not null default 'listo'`. */
export const ESTADO_POR_DEFECTO: EstadoCanto = 'listo'

/** Un valor desconocido nunca se trata como estado válido. */
export function esEstadoValido(valor: unknown): valor is EstadoCanto {
  return typeof valor === 'string' && (ESTADOS as readonly string[]).includes(valor)
}

/**
 * Lo que venga —de la base, del formulario, de un POST directo— convertido en
 * un estado del dominio.
 *
 * Cae en `listo` porque es el default de la columna: un canto sin estado
 * conocido es un canto que el coro venía cantando, no uno que no sabe.
 */
export function normalizarEstado(valor: unknown): EstadoCanto {
  return esEstadoValido(valor) ? valor : ESTADO_POR_DEFECTO
}

/**
 * El texto de la marca, o `null` si no se marca.
 *
 * `listo` no lleva etiqueta a propósito: es el caso normal y marcarlo pondría
 * una insignia en cada fila del repertorio para no decir nada. Solo se señala
 * lo excepcional — que es exactamente lo que se pidió: *«identificar aquellas
 * que están para canto»* se cumple mejor marcando las que todavía no lo están.
 */
export function etiquetaEstado(estado: EstadoCanto): string | null {
  return estado === 'en_ensayo' ? 'En ensayo' : null
}

/** El texto que ve el director al elegir, donde los dos estados sí se nombran. */
export function nombreEstado(estado: EstadoCanto): string {
  return estado === 'en_ensayo' ? 'En ensayo' : 'Listo'
}

/**
 * Cuántos cantos DISTINTOS están en ensayo.
 *
 * Cuenta por id y no por fila porque el listado agrupa por momento y el mismo
 * canto aparece una vez por cada momento que tenga: contar apariciones diría
 * "3 en ensayo" cuando hay uno solo asignado a tres momentos.
 *
 * Se calcula al leer, nunca se guarda (innegociable 4).
 */
export function contarEnEnsayo(cantos: { id: string; estado: EstadoCanto }[]): number {
  const vistos = new Set<string>()
  for (const canto of cantos) {
    if (canto.estado === 'en_ensayo') vistos.add(canto.id)
  }
  return vistos.size
}
