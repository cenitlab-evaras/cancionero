import { createHash, randomBytes } from 'node:crypto'

/**
 * El token de una invitación — SOLO SERVIDOR.
 *
 * El token crudo viaja UNA sola vez, dentro del link del correo; la base guarda
 * solo su SHA-256. Así una fuga de `invitacion` no entrega links que sirvan.
 *
 * Vive acá, y no en la action ni en la capa de datos, para que quien hashea al
 * crear y quien hashea al consultar no puedan divergir. `node:crypto` lo deja
 * fuera del bundle del cliente por construcción.
 */

/** 32 bytes al azar en hexadecimal: 64 caracteres impredecibles. */
export function tokenCrudo(): string {
  return randomBytes(32).toString('hex')
}

/** SHA-256 en hexadecimal. La base nunca ve el token crudo. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
