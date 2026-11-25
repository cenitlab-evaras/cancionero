'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LecturaGuardada, ParteParaGuardar } from '@/lib/datos/lecturas'
import { PARTES, NOMBRE_DE_PARTE, repartirLecturas, type TipoDeLectura } from '@/lib/motores/lecturas'
import { guardarLecturas, importarLecturas } from './acciones'
import { BotonIcono, clasesBotonIcono } from '@/app/componentes/boton-icono'
import { IconoCalendario, IconoCerrar, IconoSeguir, IconoVolver } from '@/app/componentes/iconos'
import { fechaEnZona, moverDia } from '@/lib/motores/fecha'

// Todo campo lleva el borde de control (3:1 contra el fondo, WCAG 1.4.11) y
// letra de 16 px: con menos, Safari de iPhone agranda la página al enfocarlo.
const CAMPO =
  'w-full rounded-lg border border-borde-fuerte bg-superficie px-3 py-2 text-base text-texto transition-colors placeholder:text-texto-tenue hover:border-texto-tenue focus:border-acento'

type Campo = {
  tipo: TipoDeLectura
  referencia: string
  texto: string
  fuente: 'iglesia.cl' | 'manual'
  fuenteUrl: string | null
  traidoEn: string | null
}

function campoVacio(tipo: TipoDeLectura): Campo {
  return { tipo, referencia: '', texto: '', fuente: 'manual', fuenteUrl: null, traidoEn: null }
}

/** Lo guardado, completado con las partes vacías: el editor muestra las cuatro. */
function camposIniciales(partes: LecturaGuardada[]): Campo[] {
  const porTipo = new Map(partes.map((p) => [p.tipo, p]))
  return PARTES.map((tipo) => {
    const p = porTipo.get(tipo)
    return p
      ? {
          tipo,
          referencia: p.referencia,
          texto: p.texto,
          fuente: p.fuente,
          fuenteUrl: p.fuenteUrl,
          traidoEn: p.traidoEn,
        }
      : campoVacio(tipo)
  })
}

/**
 * La hoja del editor de lecturas — H30.
 *
 * Vive DENTRO de la misa (un `<dialog>` sobre la página, no una ruta aparte):
 * traer, revisar, editar y guardar sin salir de donde está el director. La
 * única escritura sigue siendo `guardarLecturas`; `importarLecturas` solo trae.
 *
 * Reglas que acá se sostienen:
 *   · Editar a mano una parte importada la marca `manual` y deja de citar la
 *     URL de Iglesia.cl para esa parte.
 *   · Reimportar muestra lo traído y pide confirmación antes de reemplazar.
 *   · Guardar con las cuatro partes vacías y lecturas previas pide confirmación
 *     (la RPC borra las partes vacías; no se borra todo por accidente).
 */
export default function Editor({
  misaId,
  fecha,
  partes,
  onCerrar,
}: {
  misaId: string
  fecha: string | null
  partes: LecturaGuardada[]
  onCerrar: () => void
}) {
  const router = useRouter()
  const ref = useRef<HTMLDialogElement>(null)

  const [dia, setDia] = useState(fecha ?? '')
  const [campos, setCampos] = useState<Campo[]>(() => camposIniciales(partes))
  const [pegado, setPegado] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [trayendo, setTrayendo] = useState(false)
  const [guardando, setGuardando] = useState(false)
  // Confirmaciones en línea: la importación que va a reemplazar, y el guardado
  // que vacía las cuatro partes.
  const [reemplazo, setReemplazo] = useState<ParteParaGuardar[] | null>(null)
  const [vaciado, setVaciado] = useState(false)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  /** Editar a mano una parte importada la marca manual y le quita la URL. */
  function cambiar(tipo: TipoDeLectura, parcial: { referencia?: string; texto?: string }) {
    setCampos((previas) =>
      previas.map((c) => {
        if (c.tipo !== tipo) return c
        const editada = c.fuente === 'iglesia.cl'
        return {
          ...c,
          ...parcial,
          ...(editada ? { fuente: 'manual' as const, fuenteUrl: null, traidoEn: null } : {}),
        }
      })
    )
  }

  function aplicarImportacion(importadas: ParteParaGuardar[]) {
    const porTipo = new Map(importadas.map((p) => [p.tipo, p]))
    setCampos(
      PARTES.map((tipo) => {
        const p = porTipo.get(tipo)
        return p
          ? {
              tipo,
              referencia: p.referencia,
              texto: p.texto,
              fuente: p.fuente,
              fuenteUrl: p.fuenteUrl,
              traidoEn: p.traidoEn,
            }
          : campoVacio(tipo)
      })
    )
    setAviso(null)
  }

  async function traer() {
    setError(null)
    setAviso(null)
    setTrayendo(true)
    try {
      const r = await importarLecturas({ misaId, fecha: dia })
      if (!r.ok) {
        setError(r.error)
        return
      }
      const hayAlgo = campos.some((c) => c.texto.trim() !== '' || c.referencia.trim() !== '')
      if (hayAlgo) {
        // Reimportar reemplaza lo que hay: se muestra lo traído y se confirma.
        setReemplazo(r.partes)
      } else {
        aplicarImportacion(r.partes)
      }
    } finally {
      setTrayendo(false)
    }
  }

  function pegar() {
    setError(null)
    setAviso(null)
    const r = repartirLecturas(pegado)
    if (r.partes.length === 0) {
      setError('Pega el texto de las lecturas para poder repartirlo.')
      return
    }
    const porTipo = new Map(r.partes.map((p) => [p.tipo, p]))
    setCampos(
      PARTES.map((tipo) => {
        const p = porTipo.get(tipo)
        return p
          ? {
              tipo,
              referencia: p.referencia,
              texto: p.texto,
              fuente: 'manual' as const,
              fuenteUrl: null,
              traidoEn: null,
            }
          : campoVacio(tipo)
      })
    )
    if (!r.reconocido) {
      setAviso('No reconocí los encabezados: todo quedó en la primera lectura. Repártelo a mano si hace falta.')
    }
  }

  async function ejecutarGuardar() {
    setError(null)
    setGuardando(true)
    try {
      // Una parte sin texto no se guarda: la RPC la borra. Así se quita la
      // segunda lectura de un día que no la tiene.
      const paraGuardar: ParteParaGuardar[] = campos
        .filter((c) => c.texto.trim() !== '')
        .map((c) => ({
          tipo: c.tipo,
          referencia: c.referencia.trim(),
          texto: c.texto,
          fuente: c.fuente,
          fuenteUrl: c.fuenteUrl,
          traidoEn: c.traidoEn,
        }))
      const r = await guardarLecturas({ misaId, partes: paraGuardar })
      if (!r.ok) {
        setError(r.error)
        return
      }
      router.refresh()
      onCerrar()
    } finally {
      setGuardando(false)
    }
  }

  function pedirGuardar() {
    setError(null)
    const quedaAlgo = campos.some((c) => c.texto.trim() !== '')
    if (!quedaAlgo) {
      if (partes.length > 0) {
        // Seguridad de producto: no borrar todas las lecturas por accidente.
        setVaciado(true)
        return
      }
      // Sin lecturas previas, guardar vacío no hace nada.
      onCerrar()
      return
    }
    ejecutarGuardar()
  }

  return (
    <dialog
      ref={ref}
      aria-label="Editar lecturas"
      onCancel={(e) => {
        e.preventDefault()
        onCerrar()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onCerrar()
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-fondo p-0 text-texto"
    >
      <div className="flex h-full flex-col">
        <header className="flex min-h-11 items-center gap-1 border-b border-borde px-2">
          <BotonIcono etiqueta="Cerrar el editor" onClick={onCerrar}>
            <IconoCerrar />
          </BotonIcono>
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold">Editar lecturas</h2>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {/* El campo de fecha con sus iconos (2026-11-25): el calendario dice
              que es un día, y las flechas mueven uno sin abrir el selector.
              Sin fecha todavía, las flechas parten del día de hoy: un campo
              vacío que no responde parecía roto. */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fecha-lecturas" className="text-sm text-texto-tenue">
              Fecha del día a traer
            </label>
            <div className="flex items-center gap-1.5">
              <BotonIcono
                apariencia="borde"
                etiqueta="Día anterior"
                onClick={() => setDia((d) => moverDia(d || fechaEnZona(new Date()), -1))}
              >
                <IconoVolver tamano={18} />
              </BotonIcono>
              <div className="relative min-w-0 flex-1">
                <IconoCalendario
                  tamano={18}
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-texto-tenue"
                />
                <input
                  id="fecha-lecturas"
                  type="date"
                  value={dia}
                  onChange={(e) => setDia(e.target.value)}
                  className={`${CAMPO} pl-10`}
                />
              </div>
              <BotonIcono
                apariencia="borde"
                etiqueta="Día siguiente"
                onClick={() => setDia((d) => moverDia(d || fechaEnZona(new Date()), 1))}
              >
                <IconoSeguir tamano={18} />
              </BotonIcono>
            </div>
            <span className="text-sm text-texto-tenue">
              Por defecto la de la misa. Cámbiala para traer otro día.
            </span>
          </div>

          <button
            type="button"
            onClick={traer}
            disabled={trayendo || guardando}
            className={clasesBotonIcono('borde', 'mt-4 w-full justify-center text-base')}
          >
            {trayendo ? 'Trayendo…' : 'Traer de Iglesia.cl'}
          </button>

          {error && (
            <p role="alert" className="mt-3 text-sm text-peligro">
              {error}
            </p>
          )}
          {aviso && (
            <p role="status" className="mt-3 text-sm text-texto-tenue">
              {aviso}
            </p>
          )}

          {reemplazo && (
            <div
              role="alertdialog"
              aria-labelledby="confirmar-reemplazo-titulo"
              className="mt-4 rounded-lg border border-borde-fuerte bg-superficie p-3"
            >
              <h3 id="confirmar-reemplazo-titulo" className="text-base font-semibold">
                ¿Reemplazar las lecturas?
              </h3>
              <p className="mt-1 text-sm text-texto-tenue">
                La importación reemplaza lo que ya está. Trajo:
              </p>
              <ul className="mt-2 space-y-1">
                {reemplazo.map((p) => (
                  <li key={p.tipo} className="text-sm">
                    <span className="font-semibold text-texto-tenue">
                      {NOMBRE_DE_PARTE[p.tipo]}
                    </span>
                    {p.referencia !== '' && <> · {p.referencia}</>}
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    aplicarImportacion(reemplazo)
                    setReemplazo(null)
                  }}
                  className={clasesBotonIcono('lleno', 'text-sm')}
                >
                  Reemplazar
                </button>
                <button
                  type="button"
                  onClick={() => setReemplazo(null)}
                  className={clasesBotonIcono('borde', 'text-sm')}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {campos.map((c) => (
            <fieldset key={c.tipo} className="mt-5 border-0 p-0">
              <legend className="text-sm font-semibold text-texto-tenue">
                {NOMBRE_DE_PARTE[c.tipo]}
                {c.tipo === 'segunda' && <span className="font-normal"> · opcional</span>}
              </legend>
              <input
                value={c.referencia}
                onChange={(e) => cambiar(c.tipo, { referencia: e.target.value })}
                placeholder="Referencia (p. ej. Isaías 55, 1-11)"
                disabled={trayendo}
                className={`mt-1.5 ${CAMPO}`}
              />
              <textarea
                value={c.texto}
                onChange={(e) => cambiar(c.tipo, { texto: e.target.value })}
                placeholder="Texto de la lectura"
                rows={6}
                disabled={trayendo}
                className={`mt-2 min-h-28 ${CAMPO}`}
              />
              {c.fuente === 'iglesia.cl' && (
                <p className="mt-1 text-sm text-texto-tenue">
                  De Iglesia.cl. Al editarla quedará marcada como escrita a mano.
                </p>
              )}
            </fieldset>
          ))}

          <div className="mt-6 border-t border-borde pt-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-texto-tenue">Texto pegado</span>
              <textarea
                value={pegado}
                onChange={(e) => setPegado(e.target.value)}
                placeholder="Pega acá el texto tal como lo copiaste de la página…"
                rows={5}
                className={`min-h-24 ${CAMPO}`}
              />
            </label>
            <button
              type="button"
              onClick={pegar}
              disabled={guardando}
              className={clasesBotonIcono('borde', 'mt-2 w-full justify-center text-base')}
            >
              Pegar a mano
            </button>
          </div>

          <button
            type="button"
            onClick={pedirGuardar}
            disabled={guardando || trayendo}
            className={clasesBotonIcono('lleno', 'mt-5 w-full justify-center text-base')}
          >
            {guardando ? 'Guardando…' : 'Guardar lecturas'}
          </button>

          {vaciado && (
            <div
              role="alertdialog"
              aria-labelledby="confirmar-vaciado-titulo"
              className="mt-4 rounded-lg border border-borde-fuerte bg-superficie p-3"
            >
              <h3 id="confirmar-vaciado-titulo" className="text-base font-semibold">
                ¿Borrar las lecturas?
              </h3>
              <p className="mt-1 text-sm text-texto-tenue">
                Las cuatro partes quedaron vacías. Si guardas, se borran las lecturas de esta
                misa.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setVaciado(false)
                    ejecutarGuardar()
                  }}
                  className={clasesBotonIcono('borde', 'text-sm !text-peligro')}
                >
                  Borrar lecturas
                </button>
                <button
                  type="button"
                  onClick={() => setVaciado(false)}
                  className={clasesBotonIcono('borde', 'text-sm')}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </dialog>
  )
}
