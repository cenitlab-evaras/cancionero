'use client'

import { useEffect, useRef, useState } from 'react'
import { notasDelTono } from '@/lib/motores/dar-tono'
import { clasesBotonIcono } from './boton-icono'
import { IconoDiapason } from './iconos'

/**
 * «Dar el tono» (herramienta, 2026-10-17): toca la nota del tono y después su
 * acorde, para que el coro arranque afinado. Lo que suena lo decide
 * `notasDelTono`; acá solo se toca, con osciladores del navegador: no hay
 * archivos de audio que bajar en la iglesia.
 *
 * El `AudioContext` se crea en el primer toque y no antes: Safari de iPhone
 * no deja sonar nada que no haya empezado con un gesto. Si el teléfono está en
 * silencio, Safari tampoco suena; eso no se puede saltar desde la página.
 */
const NOTA = 1.2
const PAUSA = 0.15
const ACORDE = 2.2

export default function DarTono({ tonalidad, etiqueta }: { tonalidad: string; etiqueta: string }) {
  const contexto = useRef<AudioContext | null>(null)
  const salida = useRef<GainNode | null>(null)
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [sonando, setSonando] = useState(false)

  useEffect(
    () => () => {
      if (reloj.current) clearTimeout(reloj.current)
      void contexto.current?.close()
    },
    []
  )

  const notas = notasDelTono(tonalidad)
  if (!notas) return null

  function tocar() {
    if (!notas) return
    const ctx = contexto.current ?? new AudioContext()
    contexto.current = ctx
    void ctx.resume()

    // Tocar de nuevo corta lo que estaba sonando en vez de encimarlo.
    salida.current?.disconnect()
    const bus = ctx.createGain()
    bus.connect(ctx.destination)
    salida.current = bus

    const sonar = (frecuencia: number, inicio: number, duracion: number, volumen: number) => {
      const o = ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = frecuencia
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.0001, inicio)
      g.gain.exponentialRampToValueAtTime(volumen, inicio + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion)
      o.connect(g).connect(bus)
      o.start(inicio)
      o.stop(inicio + duracion + 0.05)
    }

    const t0 = ctx.currentTime + 0.05
    sonar(notas.nota, t0, NOTA, 0.35)
    // El acorde apenas arpegiado: se oye que son varias notas, no un timbre.
    notas.acorde.forEach((f, i) => sonar(f, t0 + NOTA + PAUSA + i * 0.05, ACORDE, 0.16))

    setSonando(true)
    if (reloj.current) clearTimeout(reloj.current)
    reloj.current = setTimeout(() => setSonando(false), (NOTA + PAUSA + ACORDE) * 1000)
  }

  // Solo el ícono (el dueño, 2026-10-17: «el puro icono»), al lado de la
  // tonalidad. El objetivo sigue siendo de 44 px; el margen negativo evita que
  // agrande el renglón de texto donde vive.
  return (
    <button
      type="button"
      onClick={tocar}
      aria-label={`Dar el tono: ${etiqueta}`}
      title={`Dar el tono: ${etiqueta}`}
      aria-pressed={sonando}
      className={clasesBotonIcono(sonando ? 'activo' : 'plano', '-my-3')}
    >
      <IconoDiapason tamano={18} />
    </button>
  )
}
