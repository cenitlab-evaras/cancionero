/**
 * El tempo del reproductor — PRD §21.6.
 *
 * Las pistas están generadas al tempo escrito en la partitura. Escuchar más
 * lento es reproducirlas a otra TASA, conservando la afinación
 * (`preservesPitch`), como hace `escuchar.html`. Regenerar a tempo real es solo
 * para exportar (§21.10), y ahí el bpm se valida como en motor/pedidos.py.
 */

/** El ajuste fino de 50–150 %. */
export const TASA_MIN = 0.5
export const TASA_MAX = 1.5

export function tasaDeTempo(bpm: number, original: number): number {
  if (!(original > 0) || !Number.isFinite(bpm)) return 1
  return Math.min(TASA_MAX, Math.max(TASA_MIN, bpm / original))
}

export function bpmDeTasa(tasa: number, original: number): number {
  return Math.round(tasa * original)
}

/**
 * Los tres botones. En `escuchar.html`, a ♩ 62, eran Lento 48 y Ensayo 56: se
 * guarda esa proporción para que en otra partitura signifiquen lo mismo.
 */
export function temposDe(original: number): { nombre: string; bpm: number }[] {
  return [
    { nombre: 'Lento', bpm: Math.round((original * 48) / 62) },
    { nombre: 'Ensayo', bpm: Math.round((original * 56) / 62) },
    { nombre: 'Original', bpm: Math.round(original) },
  ]
}

/** Para exportar (H24): entero entre 20 y 240, los límites de motor/pedidos.py. */
export function esBpmDeExportacion(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor) && valor >= 20 && valor <= 240
}
