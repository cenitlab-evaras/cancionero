'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { IconoListo } from '@/app/componentes/iconos'

/**
 * Los filtros de «Todas» (la vista unificada de Canciones). Solo llevan lo
 * elegido a la URL; filtra el motor `catalogo` en el servidor. En la URL, una
 * vista filtrada se puede compartir («mira las repetidas») y sobrevive a volver
 * atrás.
 *
 * Desde el 2026-11-19 escriben `/repertorio?vista=todas` y NO tienen campo de
 * búsqueda propio: el término `q` lo lleva el buscador compartido del bloque
 * pegajoso. Dos campos sobre el mismo `q` se pisaban (el de acá guardaba su
 * propio estado y, al tocar un filtro, reescribía el término con uno viejo).
 */
export type ValoresDeFiltro = {
  q: string
  momento: string
  estado: string
  partitura: string
  repetidas: boolean
  solistas: boolean
}

const SELECT =
  'tactil min-w-0 rounded-lg border border-borde-fuerte bg-superficie px-2 text-sm text-texto'

export default function Filtros({
  valores,
  momentos,
}: {
  valores: ValoresDeFiltro
  momentos: { codigo: string; nombre: string }[]
}) {
  const router = useRouter()
  const [, iniciarTransicion] = useTransition()

  function ir(cambio: Partial<ValoresDeFiltro>) {
    const v = { ...valores, ...cambio }
    const p = new URLSearchParams()
    p.set('vista', 'todas')
    if (v.q.trim()) p.set('q', v.q.trim())
    if (v.momento) p.set('momento', v.momento)
    if (v.estado) p.set('estado', v.estado)
    if (v.partitura) p.set('partitura', v.partitura)
    if (v.repetidas) p.set('repetidas', '1')
    if (v.solistas) p.set('solistas', '1')
    const qs = p.toString()
    iniciarTransicion(() => router.replace(`/repertorio?${qs}`, { scroll: false }))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Momento"
          value={valores.momento}
          onChange={(e) => ir({ momento: e.target.value })}
          className={SELECT}
        >
          <option value="">Todos los momentos</option>
          {momentos.map((m) => (
            <option key={m.codigo} value={m.codigo}>
              {m.nombre}
            </option>
          ))}
        </select>
        <select
          aria-label="Estado"
          value={valores.estado}
          onChange={(e) => ir({ estado: e.target.value })}
          className={SELECT}
        >
          <option value="">Listas y en ensayo</option>
          <option value="listo">Listas</option>
          <option value="en_ensayo">En ensayo</option>
        </select>
        <select
          aria-label="Partitura"
          value={valores.partitura}
          onChange={(e) => ir({ partitura: e.target.value })}
          className={SELECT}
        >
          <option value="">Con y sin partitura</option>
          <option value="con">Con partitura</option>
          <option value="sin">Sin partitura</option>
        </select>
        <label className="casilla tactil flex items-center gap-2 px-1 text-sm text-texto">
          <input
            type="checkbox"
            checked={valores.repetidas}
            onChange={(e) => ir({ repetidas: e.target.checked })}
            className="peer sr-only"
          />
          {/* La casilla dibujada: el mismo alto y contraste en todo navegador.
              El input sigue siendo nativo y accesible; solo se ve esta. */}
          <span
            aria-hidden
            className="flex size-4 shrink-0 items-center justify-center rounded border border-borde-fuerte text-transparent transition-[background-color,border-color,color] peer-checked:border-acento peer-checked:bg-acento peer-checked:text-sobre-acento caja-casilla"
          >
            <IconoListo tamano={12} />
          </span>
          Solo repetidas
        </label>
        <label className="casilla tactil flex items-center gap-2 px-1 text-sm text-texto">
          <input
            type="checkbox"
            checked={valores.solistas}
            onChange={(e) => ir({ solistas: e.target.checked })}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="flex size-4 shrink-0 items-center justify-center rounded border border-borde-fuerte text-transparent transition-[background-color,border-color,color] peer-checked:border-acento peer-checked:bg-acento peer-checked:text-sobre-acento caja-casilla"
          >
            <IconoListo tamano={12} />
          </span>
          Con solista
        </label>
      </div>
    </div>
  )
}
