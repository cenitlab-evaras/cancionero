'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MaterialDeEnsayo, Sonido } from '@/lib/datos/partitura'
import { esDelCoro, esEstrofa, nombreDeCuerda, type Cuerda } from '@/lib/motores/cuerdas'
import { alFrente, mezclaDe, volumenesQueSuenan, type Eleccion, type Mezcla, type Pista } from '@/lib/motores/mezcla'
import { notaEn } from '@/lib/motores/seguimiento'
import { TASA_MAX, TASA_MIN, bpmDeTasa, tasaDeTempo, temposDe } from '@/lib/motores/tempo'
import { BotonIcono, clasesBotonIcono } from '@/app/componentes/boton-icono'
import { IconoMezcla, IconoPausa, IconoRepetir, IconoReproducir } from '@/app/componentes/iconos'
import {
  momentoBajoElToque,
  moverMarca,
  pintarElemento,
  prepararHoja,
  seguirConLaVista,
  type DatosPartitura,
  type Elemento,
  type Pagina,
} from './hoja'

/**
 * El reproductor de ensayo — H23, portado de `escuchar.html` (PRD §21.1: su
 * conducta la validó el dueño escuchándola, y manda).
 *
 * Siete `<audio>`, uno por cuerda, todos siguiendo al primero como reloj: si uno
 * se separa más de 60 ms, se lo vuelve a poner en su lugar (§18-24). El tempo
 * cambia la TASA conservando la afinación; nada se regenera acá (§21.10).
 *
 * Las reglas —qué suena, a qué volumen, quién va al frente, qué nota se pinta—
 * viven en los motores puros. Acá solo se las aplica al audio y al SVG.
 */

const SONIDOS: Record<Sonido, string> = {
  voces: 'Voces',
  piano: 'Piano',
  organo: 'Órgano',
  guitarra: 'Guitarra',
  flauta: 'Flauta',
}

/** El margen de deriva entre pistas antes de corregirla (§18-24). */
const DERIVA_S = 0.06

const ELEGIDO = '!border-texto !bg-superficie-alta font-semibold'
const chip = (elegido: boolean) =>
  clasesBotonIcono('borde', `px-3 text-sm ${elegido ? ELEGIDO : '!text-texto-tenue'}`)

const mmss = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

/** Lo que dice un botón de la mezcla, llevado al estado del panel «Mezcla». */
function pistasDe(m: Mezcla): Record<Cuerda, Pista> {
  return Object.fromEntries(
    Object.entries(m).map(([c, v]) => [c, { volumen: v > 0 ? v : 1, silenciada: v === 0, sola: false }])
  )
}

export default function Reproductor({
  material,
  cuerdaInicial,
}: {
  material: MaterialDeEnsayo
  /** De la tesitura de la ficha (`cuerdaPorTesitura`), o null: abre con el coro. */
  cuerdaInicial: Cuerda | null
}) {
  const { cuerdas, pentagramas, tempo } = material
  const delCoro = cuerdas.filter(esDelCoro)
  const estrofas = cuerdas.filter(esEstrofa)

  // --- La mezcla ------------------------------------------------------------
  const inicial: Eleccion = cuerdaInicial ? { tipo: 'frente', cuerda: cuerdaInicial } : { tipo: 'coro' }
  // `null` = la mezcla se tocó a mano en el panel y ya no es ningún botón.
  const [eleccion, setEleccion] = useState<Eleccion | null>(inicial)
  const [pistas, setPistas] = useState<Record<Cuerda, Pista>>(() => pistasDe(mezclaDe(inicial, cuerdas)))
  const efectivos = useMemo(() => volumenesQueSuenan(pistas), [pistas])
  const frente = useMemo(() => alFrente(efectivos), [efectivos])

  function elegir(e: Eleccion) {
    const normal: Eleccion = e.tipo === 'estrofas' && e.estrofas.length === 0 ? { tipo: 'coro' } : e
    setEleccion(normal)
    setPistas(pistasDe(mezclaDe(normal, cuerdas)))
  }
  const prendidas = eleccion?.tipo === 'estrofas' ? eleccion.estrofas : []
  function alternarEstrofa(c: Cuerda) {
    elegir({
      tipo: 'estrofas',
      estrofas: prendidas.includes(c) ? prendidas.filter((x) => x !== c) : [...prendidas, c],
    })
  }
  function ajustar(c: Cuerda, cambio: Partial<Pista>) {
    setEleccion(null)
    setPistas((p) => ({ ...p, [c]: { ...p[c], ...cambio } }))
  }

  // --- El audio -------------------------------------------------------------
  const audios = useRef<Record<Cuerda, HTMLAudioElement>>({})
  const seccionHoja = useRef<HTMLElement>(null)
  const reloj = () => audios.current[pentagramas[0]]
  const todos = () => Object.values(audios.current)
  const [sonido, setSonido] = useState<Sonido>(material.sonidos[0])
  const [bpm, setBpm] = useState(tempo)
  const tasa = tasaDeTempo(bpm, tempo)
  const [sonando, setSonando] = useState(false)
  const [repetir, setRepetir] = useState(true)
  const [tiempo, setTiempo] = useState(0)
  const [duracion, setDuracion] = useState(material.duracionMs / 1000)
  const [aviso, setAviso] = useState<string | null>(null)
  const pausaPropia = useRef(false)
  const repetirRef = useRef(repetir)
  useEffect(() => {
    repetirRef.current = repetir
  }, [repetir])

  useEffect(() => {
    const creados: Record<Cuerda, HTMLAudioElement> = {}
    for (const c of new Set(pentagramas)) {
      const a = new Audio(material.pistas[material.sonidos[0]][c])
      a.preload = 'auto'
      a.preservesPitch = true // más lento, misma afinación
      creados[c] = a
    }
    audios.current = creados
    return () => {
      for (const a of Object.values(creados)) {
        a.pause()
        a.removeAttribute('src')
        a.load()
      }
    }
  }, [material, pentagramas])

  // Volúmenes: lo que dice la mezcla, cuerda por cuerda.
  useEffect(() => {
    for (const [c, a] of Object.entries(audios.current)) a.volume = efectivos[c] ?? 0
  }, [efectivos])

  // Tempo: la tasa, en todas, y también la por defecto (la que vale después de un `load`).
  useEffect(() => {
    for (const a of todos()) a.playbackRate = a.defaultPlaybackRate = tasa
  }, [tasa])

  const pausar = useCallback(() => {
    pausaPropia.current = true
    for (const a of Object.values(audios.current)) a.pause()
    pausaPropia.current = false
    setSonando(false)
  }, [])

  const tocar = useCallback(async (desde?: number) => {
    const r = audios.current[pentagramas[0]]
    if (!r) return
    let t = desde ?? r.currentTime
    if (r.ended || t >= (r.duration || Infinity) - 0.05) t = 0 // terminó: parte de nuevo
    const lista = Object.values(audios.current)
    for (const a of lista) a.currentTime = t
    try {
      // Safari exige que el audio arranque desde un toque: por eso tocar solo
      // se llama desde un botón, y si igual lo rechaza, se dice.
      await Promise.all(lista.map((a) => a.play()))
      setAviso(null)
      setSonando(true)
      llevarALaVista(seccionHoja.current)
    } catch {
      for (const a of lista) a.pause()
      setSonando(false)
      setAviso('El teléfono no dejó empezar el audio. Toca «Tocar» otra vez.')
    }
  }, [pentagramas])

  // Reloj de la pantalla y corrección de deriva, cada 200 ms.
  useEffect(() => {
    const id = setInterval(() => {
      const r = audios.current[pentagramas[0]]
      if (!r) return
      setTiempo(r.currentTime)
      if (r.duration) setDuracion(r.duration)
      if (!r.paused) {
        for (const a of Object.values(audios.current)) {
          if (Math.abs(a.currentTime - r.currentTime) > DERIVA_S) a.currentTime = r.currentTime
        }
      }
    }, 200)
    return () => clearInterval(id)
  }, [pentagramas])

  // Fin, y las pausas que no pidió nadie: el sistema pausa el audio al bloquear
  // el teléfono o al entrar una llamada. Si solo se pausara el reloj, las otras
  // seis seguirían sonando sueltas (§18-24).
  useEffect(() => {
    const r = audios.current[pentagramas[0]]
    if (!r) return
    const alTerminar = () => {
      if (repetirRef.current) {
        void tocar(0)
        return
      }
      pausar()
      for (const a of Object.values(audios.current)) a.currentTime = 0
    }
    const alPausar = () => {
      if (pausaPropia.current || r.ended) return
      pausar()
    }
    r.addEventListener('ended', alTerminar)
    r.addEventListener('pause', alPausar)
    // Al volver a la pantalla, todas al tiempo del reloj: Safari puede haberlas
    // dejado en lugares distintos mientras estaba bloqueado.
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return
      for (const a of Object.values(audios.current)) a.currentTime = r.currentTime
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      r.removeEventListener('ended', alTerminar)
      r.removeEventListener('pause', alPausar)
      document.removeEventListener('visibilitychange', alVolver)
    }
  }, [pentagramas, pausar, tocar])

  /** Cada sonido tiene sus pistas de igual duración: se cambia en el mismo punto. */
  async function cambiarSonido(s: Sonido) {
    if (s === sonido) return
    const r = reloj()
    const t = r.ended ? 0 : r.currentTime
    const sonaba = !r.paused
    pausar()
    for (const [c, a] of Object.entries(audios.current)) a.src = material.pistas[s][c]
    await Promise.all(
      todos().map(
        (a) =>
          new Promise<void>((listo) =>
            a.readyState >= 1 ? listo() : a.addEventListener('loadedmetadata', () => listo(), { once: true })
          )
      )
    )
    for (const a of todos()) {
      a.currentTime = t
      a.playbackRate = a.defaultPlaybackRate
    }
    setSonido(s)
    if (sonaba) await tocar(t)
  }

  function irA(segundos: number) {
    for (const a of todos()) a.currentTime = segundos
    setTiempo(segundos)
  }

  // --- La partitura ---------------------------------------------------------
  const contenedor = useRef<HTMLDivElement>(null)
  const hoja = useRef<{ datos: DatosPartitura; paginas: Pagina[]; elementos: Elemento[] } | null>(null)
  const [estadoHoja, setEstadoHoja] = useState<'cargando' | 'lista' | 'error'>('cargando')

  useEffect(() => {
    let vigente = true
    fetch(material.urlPartitura)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((datos: DatosPartitura) => {
        if (!vigente || !contenedor.current) return
        const { paginas, elementos } = prepararHoja(contenedor.current, datos)
        hoja.current = { datos, paginas, elementos }
        paginas.forEach((pg, p) =>
          pg.svg.addEventListener('click', (ev) => {
            const t = momentoBajoElToque(pg, p, datos.cursor, ev.clientX, ev.clientY)
            if (t !== null) irA(t / 1000)
          })
        )
        setEstadoHoja('lista')
      })
      .catch(() => vigente && setEstadoHoja('error'))
    return () => {
      vigente = false
    }
    // irA solo toca refs: no hace falta volver a preparar la hoja.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material.urlPartitura])

  // Lo que el bucle de dibujo necesita leer sin volver a armarse.
  const vivo = useRef({ efectivos, frente })
  useEffect(() => {
    vivo.current = { efectivos, frente }
  }, [efectivos, frente])

  useEffect(() => {
    let cuadro = 0
    let cursorActual = -1
    let paginaActual = 0
    const inicios: { t0: number }[] = []
    const dibujar = () => {
      cuadro = requestAnimationFrame(dibujar)
      const h = hoja.current
      const r = audios.current[pentagramas[0]]
      if (!h || !r) return
      if (inicios.length !== h.datos.cursor.length) {
        inicios.length = 0
        for (const c of h.datos.cursor) inicios.push({ t0: c.t })
      }
      const t = r.currentTime * 1000
      const empezado = t > 0 || !r.paused
      const { efectivos, frente } = vivo.current

      // Velos: la cuerda que no suena se apaga entera.
      for (const pg of h.paginas) {
        pg.velos.forEach((v, s) => {
          const ver = (efectivos[pentagramas[s]] ?? 0) > 0 ? 'none' : ''
          if (v.style.display !== ver) v.style.display = ver
        })
      }
      // Se pinta solo lo que va al frente (§21.6, `alFrente`).
      for (const e of h.elementos) {
        pintarElemento(e, empezado && frente.includes(pentagramas[e.s]) && t >= e.t0 && t < e.t1)
      }
      const i = empezado ? notaEn(t, inicios) ?? -1 : -1
      if (i !== cursorActual) {
        const c = i >= 0 ? h.datos.cursor[i] : null
        moverMarca(h.paginas, c)
        if (c) {
          if (c.p !== paginaActual && !r.paused) h.paginas[c.p].div.scrollIntoView({ block: 'start' })
          seguirConLaVista(h.paginas[c.p], c.x, !r.paused)
          paginaActual = c.p
        }
        cursorActual = i
      }
    }
    cuadro = requestAnimationFrame(dibujar)
    return () => cancelAnimationFrame(cuadro)
  }, [pentagramas])

  // --- Pantalla ---------------------------------------------------------------
  const [mezclaAbierta, setMezclaAbierta] = useState(false)
  const tempos = temposDe(tempo)
  const porcentaje = Math.round(tasa * 100)

  return (
    <>
      <div className="flex flex-col gap-5 px-4 pt-5">
        {/* «Mi cuerda», no «Mi voz» (§18-22): la palabra del coro para la sección. */}
        <Grupo titulo="Mi cuerda">
          {delCoro.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={eleccion?.tipo === 'frente' && eleccion.cuerda === c}
              onClick={() => elegir({ tipo: 'frente', cuerda: c })}
              className={chip(eleccion?.tipo === 'frente' && eleccion.cuerda === c)}
            >
              {nombreDeCuerda(c)}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={eleccion?.tipo === 'coro'}
            onClick={() => elegir({ tipo: 'coro' })}
            className={chip(eleccion?.tipo === 'coro')}
          >
            Coro
          </button>
        </Grupo>

        {estrofas.length > 0 && (
          // Se combinan entre sí, sobre el coro de fondo; sin ninguna vuelve el coro.
          <Grupo titulo="Estrofas" detalle="con el coro de fondo">
            {estrofas.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={prendidas.includes(c)}
                onClick={() => alternarEstrofa(c)}
                className={chip(prendidas.includes(c))}
              >
                {nombreDeCuerda(c)}
              </button>
            ))}
          </Grupo>
        )}

        <Grupo titulo="Tempo" detalle={`♩ ${bpm} · ${porcentaje} %`}>
          {tempos.map((t) => (
            <button
              key={t.nombre}
              type="button"
              aria-pressed={bpm === t.bpm}
              onClick={() => setBpm(t.bpm)}
              className={chip(bpm === t.bpm)}
            >
              {t.nombre} · {t.bpm}
            </button>
          ))}
          <label className="flex w-full items-center gap-3 text-sm text-texto-tenue">
            <span className="shrink-0">Ajuste fino</span>
            <input
              type="range"
              min={TASA_MIN * 100}
              max={TASA_MAX * 100}
              step={1}
              value={porcentaje}
              onChange={(e) => setBpm(bpmDeTasa(Number(e.target.value) / 100, tempo))}
              className="tactil w-full accent-[var(--color-acento)]"
            />
          </label>
        </Grupo>

        <Grupo titulo="Sonido">
          {material.sonidos.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sonido === s}
              onClick={() => void cambiarSonido(s)}
              className={chip(sonido === s)}
            >
              {SONIDOS[s]}
            </button>
          ))}
        </Grupo>
      </div>

      {/* La partitura en papel claro dentro del marco oscuro (§21.8). */}
      <section ref={seccionHoja} aria-label="Partitura" className="mt-6 scroll-mt-14 px-2">
        {estadoHoja === 'cargando' && (
          <p className="px-2 py-10 text-center text-sm text-texto-tenue">Cargando la partitura…</p>
        )}
        {estadoHoja === 'error' && (
          <p role="status" className="px-2 py-10 text-center text-sm text-peligro">
            No se pudo cargar la partitura. Vuelve a abrir esta pantalla.
          </p>
        )}
        <div ref={contenedor} />
        {estadoHoja === 'lista' && (
          <p className="px-2 pt-2 pb-6 text-sm text-texto-tenue">
            Toca la partitura para saltar a ese punto. Las cuerdas que no suenan se ven atenuadas.
          </p>
        )}
      </section>

      {/* La barra de abajo, al alcance del pulgar, como en la lectura. */}
      <div className="sticky bottom-0 z-(--z-barra) border-t border-borde bg-fondo pb-[env(safe-area-inset-bottom)]">
        {mezclaAbierta && (
          <div id="panel-mezcla" className="max-h-[50vh] overflow-y-auto border-b border-borde bg-superficie px-4 py-3">
            <p className="text-sm text-texto-tenue">
              Toca el nombre para callar una cuerda; «Sola» deja solo esa.
            </p>
            <ul className="mt-2 divide-y divide-borde">
              {cuerdas.map((c) => {
                const p = pistas[c]
                const suena = (efectivos[c] ?? 0) > 0
                return (
                  <li key={c} className="flex items-center gap-2 py-1.5">
                    <button
                      type="button"
                      aria-pressed={!p.silenciada}
                      aria-label={`${nombreDeCuerda(c)}: ${p.silenciada ? 'callada' : 'suena'}`}
                      onClick={() => ajustar(c, { silenciada: !p.silenciada })}
                      className={clasesBotonIcono(
                        'borde',
                        `w-28 justify-start px-3 text-sm ${suena ? ELEGIDO : '!text-texto-tenue line-through'}`
                      )}
                    >
                      {nombreDeCuerda(c)}
                    </button>
                    <button
                      type="button"
                      aria-pressed={p.sola}
                      onClick={() => ajustar(c, { sola: !p.sola })}
                      className={chip(p.sola)}
                    >
                      Sola
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={Math.round(p.volumen * 100)}
                      aria-label={`Volumen de ${nombreDeCuerda(c)}`}
                      onChange={(e) => ajustar(c, { volumen: Number(e.target.value) / 100 })}
                      className="tactil min-w-0 flex-1 accent-[var(--color-acento)]"
                    />
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {aviso && (
          <p role="status" className="px-4 pt-2 text-sm text-peligro">
            {aviso}
          </p>
        )}

        <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-2 py-1.5">
          <BotonIcono
            etiqueta={sonando ? 'Pausa' : 'Tocar'}
            apariencia="lleno"
            onClick={() => (sonando ? pausar() : void tocar())}
          >
            {sonando ? <IconoPausa /> : <IconoReproducir />}
          </BotonIcono>
          <span className="shrink-0 text-sm text-texto-tenue tabular-nums">
            {mmss(tiempo)} / {mmss(duracion)}
          </span>
          <input
            type="range"
            min={0}
            max={1000}
            value={duracion ? Math.round((tiempo / duracion) * 1000) : 0}
            aria-label="Posición"
            onChange={(e) => irA((Number(e.target.value) / 1000) * duracion)}
            className="tactil min-w-0 flex-1 accent-[var(--color-acento)]"
          />
          <BotonIcono
            etiqueta="Repetir"
            apariencia={repetir ? 'activo' : 'plano'}
            aria-pressed={repetir}
            onClick={() => setRepetir((r) => !r)}
          >
            <IconoRepetir />
          </BotonIcono>
          <BotonIcono
            etiqueta="Mezcla por cuerda"
            apariencia={mezclaAbierta ? 'activo' : 'plano'}
            aria-expanded={mezclaAbierta}
            aria-controls="panel-mezcla"
            onClick={() => setMezclaAbierta((a) => !a)}
          >
            <IconoMezcla />
          </BotonIcono>
        </div>
      </div>
    </>
  )
}

/** Al empezar a sonar, la partitura a la vista: es lo que hay que mirar. */
function llevarALaVista(s: HTMLElement | null) {
  if (!s) return
  const r = s.getBoundingClientRect()
  if (r.top < 0 || r.top > innerHeight * 0.6) {
    const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches
    s.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'start' })
  }
}

function Grupo({
  titulo,
  detalle,
  children,
}: {
  titulo: string
  detalle?: string
  children: React.ReactNode
}) {
  return (
    <div role="group" aria-label={titulo}>
      <p className="flex items-baseline gap-2 text-sm font-semibold text-texto">
        {titulo}
        {detalle && <span className="font-normal text-texto-tenue">{detalle}</span>}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </div>
  )
}
