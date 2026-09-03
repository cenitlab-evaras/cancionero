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

/**
 * Rol GLOBAL, en `public.perfiles`. Qué TIPO de cosas puede hacer alguien.
 *
 * `admin` NO es un tipo de persona del coro: es la cuenta de instalación
 * —aprueba altas, crea coros— y no se nombra en ninguna pantalla del coro.
 * Dentro de un coro hay dos y solo dos: director y miembro (ver abajo).
 *
 * El valor común se llama `usuario` y no `miembro` a propósito: `miembro` es
 * el rol LOCAL, y dos columnas con el mismo valor significando cosas distintas
 * es exactamente lo que PRD §5 prohíbe.
 */
export const ROLES = ['admin', 'usuario', 'externo'] as const
export type Rol = (typeof ROLES)[number]

/**
 * Rol EN UN CORO, en `public.coro_acceso`. Sobre CUÁLES actúa.
 *
 * Los dos únicos tipos de persona del coro. El director arma el repertorio y
 * las misas; el miembro lee y toca.
 */
export const ROLES_LOCALES = ['director', 'miembro'] as const
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
  'ver_misa',
  'leer_canto',
  'guardar_preferencia_propia',
  'ver_preferencia_ajena',
  'editar_ficha_propia',
  'ver_ficha_del_coro',
  'editar_canto',
  'archivar_canto',
  'asignar_momentos',
  'inscribirse_a_misa',
  'ver_inscripciones',
  'editar_misa',
  'asignar_cantos_misa',
  'quitar_canto_misa',
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
    ver_misa: true,
    leer_canto: true,
    guardar_preferencia_propia: true,
    ver_preferencia_ajena: false, // nadie, tampoco el admin
    // H14: el admin no dirige coros y §8.2 no le da motivo para leer la
    // edad de nadie. Su propia ficha sí, como cualquiera.
    editar_ficha_propia: 'solo_vinculado',
    ver_ficha_del_coro: false,
    // H15: inscribirse es declarar algo sobre uno mismo en un coro. Sin
    // vínculo no hay nada que declarar.
    inscribirse_a_misa: 'solo_vinculado',
    ver_inscripciones: 'solo_vinculado',
    editar_canto: true,
    // Archivar es del coro, y el admin no dirige ninguno: la capacidad la
    // resuelve el vínculo, igual que editar.
    archivar_canto: true,
    asignar_momentos: true,
    editar_misa: true,
    asignar_cantos_misa: true,
    quitar_canto_misa: true,
    administrar_miembros: true,
    crear_coro: true,
    aprobar_perfil: true,
    editar_catalogo: true,
  },
  usuario: {
    ver_coro: 'solo_vinculado',
    ver_repertorio: 'solo_vinculado',
    ver_misa: 'solo_vinculado',
    leer_canto: 'solo_vinculado',
    guardar_preferencia_propia: true,
    ver_preferencia_ajena: false,
    // H14: la ficha la carga cada uno; el director del coro la lee.
    editar_ficha_propia: 'solo_vinculado',
    ver_ficha_del_coro: 'solo_director',
    // H15 · LA PRIMERA ESCRITURA DEL MIEMBRO EN DATO COMPARTIDO (§19.5). Y la
    // primera lectura compartida de algo personal: a diferencia de la ficha,
    // acá el coro entero ve quién va, porque para eso existe el dato.
    //
    // No hay capacidad de inscribir a OTRO, ni siquiera para el director: la
    // inscripción es una declaración de la persona sobre sí misma.
    inscribirse_a_misa: 'solo_vinculado',
    ver_inscripciones: 'solo_vinculado',
    editar_canto: 'solo_director',
    // Sacar un canto de circulación es del director: con el admin fuera del
    // coro, él es la máxima autoridad dentro de él. Y no borra nada — §16.
    archivar_canto: 'solo_director',
    asignar_momentos: 'solo_director',
    editar_misa: 'solo_director',
    asignar_cantos_misa: 'solo_director',
    quitar_canto_misa: 'solo_director',
    administrar_miembros: 'solo_director',
    crear_coro: false,
    aprobar_perfil: false,
    editar_catalogo: false,
  },
  externo: {
    ver_coro: false,
    ver_repertorio: false,
    ver_misa: false,
    leer_canto: false,
    guardar_preferencia_propia: true,
    ver_preferencia_ajena: false,
    // Un externo no está en ningún coro: no hay ficha que cargar.
    editar_ficha_propia: false,
    ver_ficha_del_coro: false,
    inscribirse_a_misa: false,
    ver_inscripciones: false,
    editar_canto: false,
    archivar_canto: false,
    asignar_momentos: false,
    editar_misa: false,
    asignar_cantos_misa: false,
    quitar_canto_misa: false,
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
/**
 * Por qué esta persona no está viendo la app — y **solo la razón verdadera**.
 *
 * NACE DE UN ERROR CONCRETO, el 2026-09-03. La base migró el rol global de
 * `miembro` a `usuario` y la versión desplegada todavía no conocía ese valor.
 * `sesion.ts` hizo lo correcto —cerrar hacia el NO, tratando el rol
 * irreconocible como `externo`—, pero la pantalla de espera afirmaba «todavía
 * nadie habilitó tu cuenta» cuando la cuenta **estaba aprobada**. El sistema se
 * comportó bien y la pantalla mintió, que es la peor combinación: manda a la
 * persona a pedir algo que ya tiene.
 *
 * Por eso la razón se calcula acá, en una función pura con test, y no se deduce
 * del destino de la ruta.
 *
 * EL ORDEN NO ES ARBITRARIO: si falta la aprobación, eso es lo que se dice
 * aunque además el rol sea desconocido. Es lo único sobre lo que la persona
 * puede hacer algo —pedir que la aprueben—; lo otro lo arregla un despliegue.
 */
export type MotivoSinAcceso = 'sin_aprobar' | 'rol_desconocido' | 'sin_coro'

export function porQueNoEntra(estado: {
  aprobado: boolean
  /** Si `perfiles.rol` trae un valor que ESTA versión de la app conoce. */
  rolReconocido: boolean
  tieneCoro: boolean
}): MotivoSinAcceso | null {
  if (!estado.aprobado) return 'sin_aprobar'
  if (!estado.rolReconocido) return 'rol_desconocido'
  if (!estado.tieneCoro) return 'sin_coro'
  return null
}

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
