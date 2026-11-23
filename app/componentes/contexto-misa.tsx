'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { clasesBotonIcono } from './boton-icono'
import {
  IconoCelebracion,
  IconoCerrar,
  IconoComplejidad,
  IconoCoro,
  IconoEditar,
  IconoLugar,
} from './iconos'

/**
 * El contexto de la misa, a un toque (rediseño de lectura, H31).
 *
 * Cuatro íconos —coro, complejidad, celebración y lugar— en la misma fila que
 * «Empezar» y «La misa». Tocar uno abre una línea con su etiqueta y su valor;
 * se cierra sola a los 5 segundos, o al volver a tocar el mismo ícono. No es un
 * panel: es un dato que se consulta y se va.
 *
 * La complejidad NO se guarda: se calcula al leer con `nivelDeComplejidad` y
 * acá solo se muestra. El lápiz, en modo director, abre un `<dialog>` chico para
 * escribir la celebración y el lugar (texto libre, H31).
 *
 * El `setTimeout` vive en un efecto con `activo` como dependencia: al cambiar de
 * ícono —o al cerrar— React limpia el anterior, y al desmontar también. No hace
 * falta un temporizador en un ref.
 */

type Clave = 'coro' | 'nivel' | 'celebracion' | 'lugar'

type Nivel = {
  nivel: 'baja' | 'media' | 'alta'
  enEnsayo: number
  sinCantar: number
  /** Cantos distintos de la misa, para el «2 de 5». */
  total: number
}

type Resultado = { ok: true } | { ok: false; error: string }

const CAMPO =
  'h-11 w-full rounded-lg border border-borde-fuerte bg-superficie px-3 text-base text-texto transition-colors placeholder:text-texto-tenue hover:border-texto-tenue focus:border-acento'

const ID_DETALLE = 'contexto-de-la-misa'

/** «Media · 2 de 5 en ensayo»: el nivel y su porqué, sin adjetivos de más. */
function textoDeNivel({ nivel, enEnsayo, sinCantar, total }: Nivel): string {
  const nombre = nivel === 'alta' ? 'Alta' : nivel === 'media' ? 'Media' : 'Baja'
  if (nivel === 'alta') return `${nombre} · ${sinCantar} de ${total} sin cantar`
  if (nivel === 'media') return `${nombre} · ${enEnsayo} de ${total} en ensayo`
  return `${nombre} · nada en ensayo`
}

export default function ContextoMisa({
  misaId,
  coro,
  nivel,
  celebracion,
  lugar,
  puedeEditar,
  onGuardarContexto,
}: {
  misaId: string
  coro: string
  nivel: Nivel
  celebracion: string | null
  lugar: string | null
  puedeEditar: boolean
  /** La server action, atada a la misa por el `misaId` de arriba. */
  onGuardarContexto: (raw: {
    misaId: string
    celebracion: string
    lugar: string
  }) => Promise<Resultado>
}) {
  const router = useRouter()
  const [activo, setActivo] = useState<Clave | null>(null)

  // `null` en el campo no existe para el zod de la acción: para vaciar se manda
  // la cadena vacía, que la acción convierte en NULL. Nunca `null` (lo rechaza).
  const [editando, setEditando] = useState(false)
  const [valorCelebracion, setValorCelebracion] = useState('')
  const [valorLugar, setValorLugar] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const refDialogo = useRef<HTMLDialogElement>(null)

  // Al cambiar de ícono (o al cerrar) se cancela el temporizador anterior; al
  // desmontar, React corre esta misma limpieza.
  useEffect(() => {
    if (!activo) return
    const temporizador = setTimeout(() => setActivo(null), 5000)
    return () => clearTimeout(temporizador)
  }, [activo])

  useEffect(() => {
    const dialog = refDialogo.current
    if (!dialog) return
    if (editando && !dialog.open) {
      dialog.showModal()
      dialog.querySelector<HTMLInputElement>('input')?.focus()
    } else if (!editando && dialog.open) {
      dialog.close()
    }
  }, [editando])

  const detalle: Record<Clave, { rotulo: string; valor: string }> = {
    coro: { rotulo: 'Canta', valor: coro },
    nivel: { rotulo: 'Complejidad', valor: textoDeNivel(nivel) },
    celebracion: { rotulo: 'Celebración', valor: celebracion?.trim() || 'Sin indicar' },
    lugar: { rotulo: 'Lugar', valor: lugar?.trim() || 'Sin indicar' },
  }

  const botones: { clave: Clave; etiqueta: string; icono: React.ReactNode }[] = [
    { clave: 'coro', etiqueta: 'Coro que canta', icono: <IconoCoro tamano={20} /> },
    {
      clave: 'nivel',
      etiqueta: `Complejidad: ${detalle.nivel.valor}`,
      icono: <IconoComplejidad nivel={nivel.nivel} tamano={20} />,
    },
    { clave: 'celebracion', etiqueta: 'Celebración', icono: <IconoCelebracion tamano={20} /> },
    { clave: 'lugar', etiqueta: 'Lugar', icono: <IconoLugar tamano={20} /> },
  ]

  function alternar(clave: Clave) {
    setActivo((anterior) => (anterior === clave ? null : clave))
  }

  function abrirEditor() {
    setActivo(null)
    setValorCelebracion(celebracion ?? '')
    setValorLugar(lugar ?? '')
    setError(null)
    setEditando(true)
  }

  function cerrarEditor() {
    if (guardando) return
    setEditando(false)
  }

  async function guardar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      const r = await onGuardarContexto({
        misaId,
        // Vacío es válido: la acción lo guarda como «sin indicar».
        celebracion: valorCelebracion.trim(),
        lugar: valorLugar.trim(),
      })
      if (!r.ok) {
        setError(r.error)
        return
      }
      setEditando(false)
      router.refresh()
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className={`shrink-0 ${puedeEditar ? 'w-[220px]' : 'w-[176px]'}`}>
      <div className="flex items-center">
        {botones.map(({ clave, etiqueta, icono }) => (
          <button
            key={clave}
            type="button"
            aria-label={etiqueta}
            aria-expanded={activo === clave}
            aria-controls={ID_DETALLE}
            onClick={() => alternar(clave)}
            className={`flex h-11 w-11 items-center justify-center rounded-[11px] transition-colors ${
              activo === clave
                ? 'bg-superficie-alta text-texto'
                : 'text-texto-tenue hover:bg-superficie hover:text-texto'
            }`}
          >
            {icono}
          </button>
        ))}

        {puedeEditar && (
          <button
            type="button"
            aria-label="Editar celebración y lugar"
            onClick={abrirEditor}
            className="flex h-11 w-11 items-center justify-center rounded-[11px] text-texto-tenue transition-colors hover:bg-superficie hover:text-texto"
          >
            <IconoEditar tamano={20} />
          </button>
        )}
      </div>

      {/* La línea de abajo. Cuando no hay nada abierto queda vacía y fuera del
          flujo (`sr-only`), pero sigue en el DOM para que `aria-controls` tenga
          a qué apuntar y el lector anuncie el cambio. */}
      <div
        id={ID_DETALLE}
        aria-live="polite"
        className={
          activo
            ? 'mt-1.5 border-t border-borde pt-1.5 text-[13px] leading-snug text-texto'
            : 'sr-only'
        }
      >
        {activo && (
          <>
            <span className="mr-1.5 text-[0.6875rem] font-bold text-texto-tenue">
              {detalle[activo].rotulo}
            </span>
            {detalle[activo].valor}
          </>
        )}
      </div>

      {puedeEditar && (
        <dialog
          ref={refDialogo}
          aria-labelledby="contexto-titulo"
          onCancel={(e) => {
            e.preventDefault()
            cerrarEditor()
          }}
          onClick={(e) => {
            if (e.target === refDialogo.current) cerrarEditor()
          }}
          className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-2xl border border-borde-fuerte bg-superficie p-4 text-texto"
        >
          <div className="flex items-center gap-2">
            <h2 id="contexto-titulo" className="min-w-0 flex-1 text-base font-semibold">
              Celebración y lugar
            </h2>
            <button
              type="button"
              onClick={cerrarEditor}
              disabled={guardando}
              aria-label="Cerrar"
              className={clasesBotonIcono('plano', 'disabled:opacity-40')}
            >
              <IconoCerrar tamano={20} />
            </button>
          </div>

          <form onSubmit={guardar} className="mt-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-texto-tenue">Celebración</span>
              <input
                value={valorCelebracion}
                onChange={(e) => setValorCelebracion(e.target.value)}
                maxLength={200}
                placeholder="Domingo 33 del Tiempo Ordinario"
                className={CAMPO}
              />
            </label>

            <label className="mt-3 flex flex-col gap-1.5">
              <span className="text-sm text-texto-tenue">Lugar</span>
              <input
                value={valorLugar}
                onChange={(e) => setValorLugar(e.target.value)}
                maxLength={200}
                placeholder="Capilla del colegio"
                className={CAMPO}
              />
            </label>

            {error && (
              <p role="alert" className="mt-3 text-sm text-peligro">
                {error}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={cerrarEditor}
                disabled={guardando}
                className={clasesBotonIcono('plano', 'px-4 disabled:opacity-40')}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando}
                className={clasesBotonIcono('lleno', 'px-4 disabled:opacity-40')}
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  )
}
