'use client'

import { useSyncExternalStore } from 'react'

/**
 * Ver la partitura o solo escucharla (el dueño, 2026-10-17: «puedo querer solo
 * escucharla»). Es una comodidad de cada teléfono, no del coro: vive en el
 * navegador. Si el navegador no deja guardar (ventana privada, datos
 * bloqueados), vale en memoria mientras dure la pantalla.
 *
 * Lo leen dos piezas que no comparten padre cliente —el interruptor del
 * renglón de las pestañas y el reproductor—, por eso es un pequeño almacén y no
 * un `useState`.
 */
const CLAVE = 'cantoral_ver_partitura'
const avisos = new Set<() => void>()
let enMemoria: boolean | null = null

export function leerVerPartitura(): boolean {
  if (enMemoria !== null) return enMemoria
  try {
    return localStorage.getItem(CLAVE) !== 'no'
  } catch {
    return true
  }
}

function suscribir(aviso: () => void) {
  avisos.add(aviso)
  return () => {
    avisos.delete(aviso)
  }
}

export function guardarVerPartitura(ver: boolean) {
  enMemoria = ver
  try {
    localStorage.setItem(CLAVE, ver ? 'si' : 'no')
  } catch {}
  avisos.forEach((aviso) => aviso())
}

/** El servidor no sabe qué eligió este teléfono: pinta la partitura y el navegador corrige al hidratar. */
export function useVerPartitura(): boolean {
  return useSyncExternalStore(suscribir, leerVerPartitura, () => true)
}
