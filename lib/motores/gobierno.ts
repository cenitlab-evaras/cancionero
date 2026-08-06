import type { Rol, RolLocal } from '@/lib/permisos'

/**
 * Las reglas del alta al coro (H7 · docs/PRD.md §8.4).
 *
 * El orden del alta es: el admin APRUEBA el perfil, y recién después el
 * director lo VINCULA a su coro. Este archivo es esa regla, escrita una vez y
 * probada sola, para que la server action y la pantalla consulten lo mismo.
 *
 * La RLS lo hace cumplir igual (la política de `coro_acceso` exige que el
 * perfil vinculado esté aprobado). Esto no la reemplaza: la convierte en un
 * mensaje en vez de un rechazo mudo (§8.3).
 */

export type Vinculable = { aprobado: boolean; rol: Rol }
export type Veredicto = { ok: true } | { ok: false; motivo: string }

/**
 * ¿Se puede vincular este perfil a un coro?
 *
 * Cierra hacia el NO, igual que `puede()`: el portón `aprobado` va primero y
 * sin excepciones.
 */
export function puedeVincularse(perfil: Vinculable): Veredicto {
  if (!perfil.aprobado) {
    return {
      ok: false,
      motivo: 'Todavía no está aprobado. Un administrador tiene que habilitar la cuenta primero.',
    }
  }

  // `externo` es quien no pertenece a la instalación. Aprobarlo le da entrada,
  // no lo hace miembro de un coro.
  if (perfil.rol === 'externo') {
    return { ok: false, motivo: 'Es una cuenta externa: no puede pertenecer a un coro.' }
  }

  return { ok: true }
}

export type PerfilDelCoro = { id: string; aprobado: boolean; rolLocal: RolLocal | null }

/**
 * Separa a los que ya están en el coro de los que se pueden agregar.
 *
 * Los no aprobados NO son "disponibles": ofrecerlos sería ofrecer algo que
 * `puedeVincularse` va a rechazar, y una pantalla que ofrece lo imposible es
 * una pantalla que miente.
 */
export function resumenDeMiembros<T extends PerfilDelCoro>(perfiles: T[]) {
  const enElCoro = perfiles.filter((p) => p.rolLocal !== null)

  return {
    enElCoro,
    disponibles: perfiles.filter((p) => p.rolLocal === null && p.aprobado),
    // Para avisar antes de que un coro se quede sin nadie que pueda armar la misa.
    directores: enElCoro.filter((p) => p.rolLocal === 'director').length,
  }
}
