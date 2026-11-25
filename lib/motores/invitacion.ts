/**
 * La invitación por email — docs/superpowers/specs/2026-11-25-invitaciones-design.md.
 *
 * Función PURA y sin datos: la comparten la lista de pendientes, la pantalla de
 * aceptación y las server actions, para que el correo que se guarda y el que se
 * compara sean siempre el mismo.
 *
 * Sin red, sin Supabase y sin reloj: el «ahora» entra como parámetro.
 */

/** Días que vale un link de invitación antes de tener que reenviarlo. */
export const DIAS_DE_VALIDEZ = 7

const MS_POR_DIA = 24 * 60 * 60 * 1000

/**
 * Recorta y baja a minúsculas.
 *
 * El correo es la llave con la que la RPC `aceptar_invitacion` compara al
 * invitado con su perfil, así que se normaliza SIEMPRE antes de guardar y
 * antes de comparar: `Juan.Perez@Coro.CL` y `juan.perez@coro.cl` son la misma
 * persona.
 */
export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}

/**
 * Una invitación vencida ya no se acepta.
 *
 * El instante exacto del vencimiento cuenta como vencido, igual que en la RPC
 * (`expira_en > now()`).
 */
export function estaVencida(expiraEn: string, ahora: Date): boolean {
  return Date.parse(expiraEn) <= ahora.getTime()
}

/** El `expira_en` de una invitación nueva, a partir de un «ahora» dado. */
export function vencimientoDesde(ahora: Date): string {
  return new Date(ahora.getTime() + DIAS_DE_VALIDEZ * MS_POR_DIA).toISOString()
}
