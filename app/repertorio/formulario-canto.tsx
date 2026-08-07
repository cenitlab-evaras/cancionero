'use client'

import { useMemo, useState, useTransition } from 'react'
import { renderizarCifrado } from '@/lib/motores/renderizar-cifrado'
import { validarCanto, type Campo } from '@/lib/motores/validar-canto'
import { desdeElCancionero, pareceAcordesSobreLetra } from '@/lib/motores/acordes-sobre-letra'
import { esNotacionLatina } from '@/lib/motores/notacion-latina'
import { ESTADOS, nombreEstado, type EstadoCanto } from '@/lib/motores/estado-canto'
import { crearCanto, editarCanto } from './acciones'

/**
 * Alta y edición de un canto (H8).
 *
 * La vista previa usa el MISMO motor que la vista de lectura, corriendo en el
 * navegador mientras se escribe: `renderizarCifrado` es puro, así que no hace
 * falta guardar para ver dónde cae cada acorde. Sin esto, posicionar un acorde
 * sobre su sílaba es a ciegas — y §17.1 ya declaró que eso se corrige a oído,
 * o sea que se itera.
 *
 * La validación es la misma función que corre la server action, para que el
 * mensaje que se ve acá y la regla que se aplica allá no puedan divergir.
 */

export type MomentoOpcion = { id: string; nombre: string; orden: number }

export type ValoresCanto = {
  titulo: string
  autorNombre: string
  cifrado: string
  tonalidadOriginal: string
  momentoIds: string[]
  estado: EstadoCanto
  fuenteTitulo: string
  fuenteNumero: string
  fuentePagina: string
}

const CAMPO =
  'rounded-lg border border-borde-fuerte bg-superficie px-3 py-2 text-texto transition-colors placeholder:text-texto-tenue hover:border-texto-tenue focus:border-acento'

export default function FormularioCanto({
  momentos,
  inicial,
  cantoId,
  autoresConocidos,
}: {
  momentos: MomentoOpcion[]
  inicial: ValoresCanto
  cantoId?: string
  autoresConocidos: string[]
}) {
  const [v, setV] = useState<ValoresCanto>(inicial)
  const [errores, setErrores] = useState<Partial<Record<Campo, string>>>({})
  const [error, setError] = useState<string | null>(null)
  const [pendiente, empezar] = useTransition()

  const set = <K extends keyof ValoresCanto>(k: K, valor: ValoresCanto[K]) =>
    setV((prev) => ({ ...prev, [k]: valor }))

  // La previa se recalcula en cada tecla. El motor es puro y el cifrado de un
  // canto son decenas de líneas: no hace falta memo por rendimiento, pero sí
  // para no rearmar el array en renders que no tocan el cifrado.
  const previa = useMemo(() => {
    try {
      return renderizarCifrado(v.cifrado, { ancho: 42 }).lineas
    } catch {
      return []
    }
  }, [v.cifrado])

  /**
   * ¿Lo que hay escrito viene del cancionero y todavía no se convirtió?
   *
   * Se OFRECE la conversión, no se impone: convertir a la fuerza lo que alguien
   * escribió a propósito sería peor que no convertir. Pero callarse tampoco
   * sirve — la primera carga real de un canto se guardó sin un solo acorde
   * reconocible, y nada avisó.
   */
  const diagnostico = useMemo(() => {
    if (v.cifrado.trim() === '') return null

    const sobreLetra = pareceAcordesSobreLetra(v.cifrado)
    const lineasLatinas = v.cifrado.split('\n').filter((l) => esNotacionLatina(l)).length
    const tieneCorchetes = v.cifrado.includes('[')
    const acordesReconocidos = previa.reduce((n, l) => n + (l.acordes?.length ?? 0), 0)

    if (sobreLetra || lineasLatinas > 0) {
      return {
        tipo: 'convertible' as const,
        texto:
          sobreLetra && lineasLatinas > 0
            ? 'Está en el formato del cancionero y en notación latina.'
            : sobreLetra
              ? 'Los acordes están en una línea aparte, como en el cancionero.'
              : 'Los acordes están en notación latina (RE, MIm7).',
      }
    }

    // Ni corchetes ni acordes: se guardaría como texto plano y nadie lo sabría.
    if (!tieneCorchetes && acordesReconocidos === 0) {
      return {
        tipo: 'sin-acordes' as const,
        texto: 'No reconocí ningún acorde. Si el canto es solo letra, está bien así.',
      }
    }

    return null
  }, [v.cifrado, previa])

  function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    // Se valida antes de salir a la red: el error por campo aparece al toque.
    const local = validarCanto({
      titulo: v.titulo,
      cifrado: v.cifrado,
      tonalidadOriginal: v.tonalidadOriginal,
      fuenteNumero: v.fuenteNumero ? Number(v.fuenteNumero) : null,
      fuentePagina: v.fuentePagina ? Number(v.fuentePagina) : null,
    })
    if (!local.ok) {
      setErrores(local.errores)
      return
    }
    if (v.momentoIds.length === 0) {
      setError('Elige al menos un momento litúrgico.')
      return
    }
    setErrores({})

    const payload = {
      titulo: v.titulo,
      cifrado: v.cifrado,
      autorNombre: v.autorNombre,
      tonalidadOriginal: v.tonalidadOriginal,
      momentoIds: v.momentoIds,
      estado: v.estado,
      fuenteTitulo: v.fuenteTitulo,
      fuenteNumero: v.fuenteNumero ? Number(v.fuenteNumero) : null,
      fuentePagina: v.fuentePagina ? Number(v.fuentePagina) : null,
    }

    empezar(async () => {
      const r = cantoId ? await editarCanto(cantoId, payload) : await crearCanto(payload)
      // Si sale bien, la action redirige y esto no se ejecuta.
      if (r && !r.ok) {
        if (r.errores) setErrores(r.errores)
        if (r.error) setError(r.error)
      }
    })
  }

  const Error = ({ campo }: { campo: Campo }) =>
    errores[campo] ? <span className="text-xs text-peligro">{errores[campo]}</span> : null

  return (
    <form onSubmit={guardar} className="mt-6 flex flex-col gap-4 pb-10">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-texto-tenue">Título</span>
        <input
          value={v.titulo}
          onChange={(e) => set('titulo', e.target.value)}
          placeholder="Alma misionera"
          className={`h-11 ${CAMPO}`}
          aria-invalid={!!errores.titulo}
        />
        <Error campo="titulo" />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-texto-tenue">Autor</span>
        <input
          value={v.autorNombre}
          onChange={(e) => set('autorNombre', e.target.value)}
          placeholder="Déjalo vacío si la fuente no lo declara"
          list="autores-conocidos"
          className={`h-11 ${CAMPO}`}
        />
        {/* Sugiere los que ya existen para no ensuciar el catálogo global con
            variantes del mismo nombre; si no está, se crea al guardar. */}
        <datalist id="autores-conocidos">
          {autoresConocidos.map((a) => (
            <option key={a} value={a} />
          ))}
        </datalist>
      </label>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-xs text-texto-tenue">Momentos</legend>
        <div className="flex flex-wrap gap-1.5">
          {momentos.map((m) => {
            const elegido = v.momentoIds.includes(m.id)
            return (
              <button
                key={m.id}
                type="button"
                onClick={() =>
                  set(
                    'momentoIds',
                    elegido ? v.momentoIds.filter((x) => x !== m.id) : [...v.momentoIds, m.id]
                  )
                }
                aria-pressed={elegido}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  elegido
                    ? 'border-acento bg-superficie-alta text-texto'
                    : 'border-borde text-texto-tenue hover:border-borde-fuerte'
                }`}
              >
                {m.nombre}
              </button>
            )
          })}
        </div>
        <span className="text-[0.6875rem] text-texto-tenue">
          Un canto puede servir para más de uno.
        </span>
      </fieldset>

      {/* H10 · El estado es del CANTO, no de quien lo mira: lo mueve el director
          y lo ve todo el coro. Por eso está acá, en la edición del canto, y no
          en la vista de lectura junto a la transposición —que sí es privada. */}
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-xs text-texto-tenue">Estado</legend>
        <div className="flex flex-wrap gap-1.5">
          {ESTADOS.map((e) => {
            const elegido = v.estado === e
            return (
              <button
                key={e}
                type="button"
                onClick={() => set('estado', e)}
                aria-pressed={elegido}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  elegido
                    ? 'border-acento bg-superficie-alta text-texto'
                    : 'border-borde text-texto-tenue hover:border-borde-fuerte'
                }`}
              >
                {nombreEstado(e)}
              </button>
            )
          })}
        </div>
        <span className="text-[0.6875rem] text-texto-tenue">
          «En ensayo» marca el canto en el repertorio para que el coro sepa que todavía se está
          sacando. No lo esconde ni impide agregarlo a una misa.
        </span>
      </fieldset>

      <label className="flex w-32 flex-col gap-1.5">
        <span className="text-xs text-texto-tenue">Tonalidad</span>
        <input
          value={v.tonalidadOriginal}
          onChange={(e) => set('tonalidadOriginal', e.target.value)}
          placeholder="D"
          className={`h-11 font-cifrado ${CAMPO}`}
          aria-invalid={!!errores.tonalidadOriginal}
        />
        <Error campo="tonalidadOriginal" />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-texto-tenue">Cifrado (ChordPro)</span>
        <textarea
          value={v.cifrado}
          onChange={(e) => set('cifrado', e.target.value)}
          rows={12}
          placeholder="[D]Señor, toma mi [G]vida nueva"
          spellCheck={false}
          className={`font-cifrado text-sm ${CAMPO}`}
          aria-invalid={!!errores.cifrado}
        />
        <Error campo="cifrado" />
        <span className="text-[0.6875rem] text-texto-tenue">
          El acorde entre corchetes, pegado a la sílaba donde cae. También puedes pegarlo tal como
          está en el cancionero.
        </span>
      </label>

      {/* El aviso que faltaba: sin esto, un cifrado del cancionero se guarda
          como texto plano —sin acordes, sin diagramas, sin transposición— y
          nada lo dice. */}
      {diagnostico && (
        <div
          className={`flex flex-col gap-2 rounded-lg border px-3 py-2.5 ${
            diagnostico.tipo === 'convertible' ? 'border-acento/40 bg-superficie' : 'border-borde'
          }`}
        >
          <span className="text-xs text-texto-tenue">{diagnostico.texto}</span>

          {diagnostico.tipo === 'convertible' ? (
            <button
              type="button"
              onClick={() => set('cifrado', desdeElCancionero(v.cifrado))}
              className="tactil self-start rounded-lg border border-acento px-3 text-sm text-acento"
            >
              Convertir del cancionero
            </button>
          ) : (
            <span className="text-[0.6875rem] leading-relaxed text-texto-tenue">
              Si tiene acordes, van entre corchetes y en notación americana:{' '}
              <span className="font-cifrado text-texto">[D]Esta ma[Em7]ñana</span>
              <br />
              DO=C · RE=D · MI=E · FA=F · SOL=G · LA=A · SI=B
            </span>
          )}
        </div>
      )}

      {/* La previa: el mismo motor que la vista de lectura, en vivo. */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-texto-tenue">Cómo se va a ver</span>
        <div className="cifrado overflow-x-auto rounded-lg border border-borde bg-fondo px-3 py-3 text-sm">
          {previa.length === 0 ? (
            <span className="text-texto-tenue">Escribe el cifrado y aparece acá.</span>
          ) : (
            previa.map((linea, i) => {
              if (linea.esSeparador) return <div key={i} className="h-3" aria-hidden />
              if (linea.esComentario)
                return (
                  <div key={i} className="mt-2 italic text-texto-tenue">
                    {linea.texto}
                  </div>
                )
              let acordes = ''
              for (const a of linea.acordes) {
                acordes = acordes.padEnd(a.columnaPintada, ' ') + a.acorde
              }
              return (
                <div key={i}>
                  {linea.acordes.length > 0 && (
                    <div className="whitespace-pre font-semibold text-acorde">{acordes}</div>
                  )}
                  <div className="whitespace-pre text-texto">{linea.texto || ' '}</div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <details className="rounded-lg border border-borde px-3 py-2">
        <summary className="cursor-pointer text-xs text-texto-tenue">
          Procedencia (de dónde salió)
        </summary>
        <div className="mt-3 flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-texto-tenue">Cancionero</span>
            <input
              value={v.fuenteTitulo}
              onChange={(e) => set('fuenteTitulo', e.target.value)}
              placeholder="Cancionero Misionero — Coro Misión País 2025"
              className={`h-11 ${CAMPO}`}
            />
          </label>
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs text-texto-tenue">N.º de canto</span>
              <input
                value={v.fuenteNumero}
                onChange={(e) => set('fuenteNumero', e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                className={`h-11 font-cifrado ${CAMPO}`}
                aria-invalid={!!errores.fuenteNumero}
              />
              <Error campo="fuenteNumero" />
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs text-texto-tenue">Página</span>
              <input
                value={v.fuentePagina}
                onChange={(e) => set('fuentePagina', e.target.value.replace(/\D/g, ''))}
                inputMode="numeric"
                className={`h-11 font-cifrado ${CAMPO}`}
                aria-invalid={!!errores.fuentePagina}
              />
              <Error campo="fuentePagina" />
            </label>
          </div>
          <span className="text-[0.6875rem] leading-relaxed text-texto-tenue">
            Si lo dejas vacío, el canto no muestra procedencia al pie. Es preferible a inventarla.
          </span>
        </div>
      </details>

      {error && <p className="text-sm text-peligro">{error}</p>}

      <button
        type="submit"
        disabled={pendiente}
        className="tactil rounded-lg bg-acento font-medium text-white disabled:opacity-40"
      >
        {pendiente ? 'Guardando…' : cantoId ? 'Guardar cambios' : 'Crear canto'}
      </button>
    </form>
  )
}
