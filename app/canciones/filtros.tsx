'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { IconoBuscar } from '@/app/componentes/iconos'

/**
 * Los filtros de «Canciones». Solo llevan lo elegido a la URL; filtra el motor
 * `catalogo` en el servidor. En la URL, una vista filtrada se puede compartir
 * («mira las repetidas») y sobrevive a volver atrás.
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
  const [texto, setTexto] = useState(valores.q)
  const [, iniciarTransicion] = useTransition()
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null)

  function ir(cambio: Partial<ValoresDeFiltro>) {
    const v = { ...valores, q: texto, ...cambio }
    const p = new URLSearchParams()
    if (v.q.trim()) p.set('q', v.q.trim())
    if (v.momento) p.set('momento', v.momento)
    if (v.estado) p.set('estado', v.estado)
    if (v.partitura) p.set('partitura', v.partitura)
    if (v.repetidas) p.set('repetidas', '1')
    if (v.solistas) p.set('solistas', '1')
    const qs = p.toString()
    iniciarTransicion(() => router.replace(qs ? `/canciones?${qs}` : '/canciones', { scroll: false }))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <IconoBuscar
          tamano={18}
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-tenue"
        />
        {/* text-base: con menos de 16 px Safari de iPhone agranda la página al enfocar. */}
        <input
          type="search"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value)
            if (espera.current) clearTimeout(espera.current)
            const q = e.target.value
            espera.current = setTimeout(() => ir({ q }), 250)
          }}
          placeholder="Título o autor"
          aria-label="Buscar por título o autor"
          className="tactil w-full rounded-lg border border-borde-fuerte bg-superficie pr-3 pl-9 text-base text-texto placeholder:text-texto-tenue"
        />
      </div>
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
        <label className="tactil flex items-center gap-2 px-1 text-sm text-texto">
          <input
            type="checkbox"
            checked={valores.repetidas}
            onChange={(e) => ir({ repetidas: e.target.checked })}
            className="size-4 accent-[var(--color-acento)]"
          />
          Solo repetidas
        </label>
        <label className="tactil flex items-center gap-2 px-1 text-sm text-texto">
          <input
            type="checkbox"
            checked={valores.solistas}
            onChange={(e) => ir({ solistas: e.target.checked })}
            className="size-4 accent-[var(--color-acento)]"
          />
          Con solista
        </label>
      </div>
    </div>
  )
}
