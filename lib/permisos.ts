/**
 * Matriz de capacidades de Cantoral — docs/PRD.md §8.2.
 *
 * Función PURA, segura para el cliente: sin acceso a datos, sin `process.env`,
 * sin importar nada del servidor.
 *
 * Esta matriz NO es la seguridad: la seguridad es la RLS. Esto es la interfaz.
 * Regla de arbitraje (PRD §8.3): si las dos discrepan, MANDA LA RLS y la
 * discrepancia es un bug — no se "arregla" aflojando la política para que la
 * pantalla funcione.
 */

/** Rol GLOBAL, en `public.perfiles`. Qué TIPO de cosas puede hacer alguien. */
export const ROLES = ['admin', 'miembro', 'externo'] as const
export type Rol = (typeof ROLES)[number]

/** Rol EN UN CORO, en `public.coro_acceso`. Sobre CUÁLES actúa. */
export const ROLES_LOCALES = ['director', 'musico'] as const
export type RolLocal = (typeof ROLES_LOCALES)[number]

/**
 * Quién pregunta, respecto del coro activo. Se pasa el sujeto completo —no solo
 * el rol— para que ninguna pantalla se olvide del portón `aprobado` ni resuelva
 * el vínculo al coro por su cuenta.
 *
 * `rolLocal: null` significa "no está vinculado al coro activo".
 */
export type Sujeto = {
  rol: Rol
  aprobado: boolean
  rolLocal: RolLocal | null
}

export const CAPACIDADES = [
  'ver_coro',
  'ver_repertorio',
  'ver_celebracion',
  'leer_canto',
  'guardar_preferencia_propia',
  'ver_preferencia_ajena',
  'editar_canto',
  'asignar_momentos',
  'editar_celebracion',
  'asignar_cantos_celebracion',
  'quitar_canto_celebracion',
  'administrar_miembros',
  'crear_coro',
  'aprobar_perfil',
  'editar_catalogo',
] as const
export type Capacidad = (typeof CAPACIDADES)[number]

/**
 * Una celda es `true`, `false`, o condicional al vínculo con el coro.
 *
 * `solo_director` existe porque el permiso de editar no depende del rol global
 * sino del rol EN ESE CORO. Fingir que es booleano obliga a resolver la
 * condición en cada pantalla, y ahí es donde una se la olvida.
 */
type Celda = boolean | 'solo_director' | 'solo_vinculado'

/**
 * Sin celdas ambiguas: cada par rol × capacidad está cerrado.
 * Espejo exacto de la tabla del PRD §8.2.
 */
const MATRIZ: Record<Rol, Record<Capacidad, Celda>> = {
  admin: {
    ver_coro: true,
    ver_repertorio: true,
    ver_celebracion: true,
    leer_canto: true,
    guardar_preferencia_propia: true,
    ver_preferencia_ajena: false, // nadie, tampoco el admin
    editar_canto: true,
    asignar_momentos: true,
    editar_celebracion: true,
    asignar_cantos_celebracion: true,
    quitar_canto_celebracion: true,
    administrar_miembros: true,
    crear_coro: true,
    aprobar_perfil: true,
    editar_catalogo: true,
  },
  miembro: {
    ver_coro: 'solo_vinculado',
    ver_repertorio: 'solo_vinculado',
    ver_celebracion: 'solo_vinculado',
    leer_canto: 'solo_vinculado',
    guardar_preferencia_propia: true,
    ver_preferencia_ajena: false,
    editar_canto: 'solo_director',
    asignar_momentos: 'solo_director',
    editar_celebracion: 'solo_director',
    asignar_cantos_celebracion: 'solo_director',
    quitar_canto_celebracion: 'solo_director',
    administrar_miembros: 'solo_director',
    crear_coro: false,
    aprobar_perfil: false,
    editar_catalogo: false,
  },
  externo: {
    ver_coro: false,
    ver_repertorio: false,
    ver_celebracion: false,
    leer_canto: false,
    guardar_preferencia_propia: true,
    ver_preferencia_ajena: false,
    editar_canto: false,
    asignar_momentos: false,
    editar_celebracion: false,
    asignar_cantos_celebracion: false,
    quitar_canto_celebracion: false,
    administrar_miembros: false,
    crear_coro: false,
    aprobar_perfil: false,
    editar_catalogo: false,
  },
}

/**
 * `aprobado` es el portón: un rol sin aprobación no puede nada.
 * Va dentro del sujeto para que no se pueda consultar la matriz sin mirarlo.
 */
export function puede(sujeto: Sujeto, capacidad: Capacidad): boolean {
  if (!sujeto.aprobado) return false
  const celda = MATRIZ[sujeto.rol]?.[capacidad]
  if (celda === undefined) return false
  // Los casos condicionales cierran hacia el NO: sin vínculo, no se concede.
  if (celda === 'solo_director') return sujeto.rolLocal === 'director'
  if (celda === 'solo_vinculado') return sujeto.rolLocal !== null
  return celda
}

/** Las capacidades de un sujeto, para pintar navegación o menús. */
export function capacidadesDe(sujeto: Sujeto): Capacidad[] {
  return CAPACIDADES.filter((c) => puede(sujeto, c))
}

/** A dónde va este usuario al entrar. Una sola fuente para el enrutamiento. */
export function rutaInicial(sujeto: Sujeto): string {
  if (!sujeto.aprobado) return '/esperando-aprobacion'
  if (puede(sujeto, 'ver_repertorio')) return '/repertorio'
  if (puede(sujeto, 'crear_coro')) return '/coros'
  return '/esperando-aprobacion'
}

/**
 * Sobre CUÁNTOS coros actúa un rol. No es booleano, por eso no vive en la
 * matriz: el alcance real lo impone la RLS con `puede_ver_coro(id)`, y esto solo
 * le sirve a la interfaz para saber si mostrar el selector de coro.
 */
export function alcance(rol: Rol): 'todos' | 'vinculados' {
  return rol === 'admin' ? 'todos' : 'vinculados'
}

/** Un rol desconocido nunca se trata como válido. */
export function esRolValido(valor: string): valor is Rol {
  return (ROLES as readonly string[]).includes(valor)
}
