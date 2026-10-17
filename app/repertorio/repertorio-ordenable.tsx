'use client'

import { useMemo, useRef, useState, useSyncExternalStore, useTransition } from 'react'
import {
  closestCorners,
  defaultDropAnimationSideEffects,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
  type UniqueIdentifier,
} from '@dnd-kit/core'
import {
  arrayMove,
  sortableKeyboardCoordinates,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import TituloSeccion from '@/app/componentes/titulo-seccion'
import { IconoAgarrar } from '@/app/componentes/iconos'
import { soltarCanto } from '@/lib/motores/orden-en-el-momento'
import { soltarEnElRepertorio } from './acciones'
import FilaCanto, { type DatosFila } from './fila-canto'

/**
 * El repertorio del director, que se ordena arrastrando (el dueño, 2026-10-17:
 * «prefiero que ordenar sea con el clásico mover con el dedo o mouse. Y se
 * puede cambiar de sección de la misa también»).
 *
 * Se arrastra SOLO desde el asa ⋮⋮ de la derecha: el resto de la fila sigue
 * siendo el enlace al canto, y el dedo que recorre la lista hace scroll como
 * siempre. Soltar en otra sección cambia el canto de momento.
 *
 * Cada fila se identifica por momento y canto («entrada|uuid»): un canto puede
 * ir en varios momentos, y la librería necesita ids únicos en toda la lista.
 * Al soltar, las listas se rearman con el MISMO motor que usa el servidor
 * (`soltarCanto`), desde la foto que se sacó al levantar el canto: lo que se ve
 * es lo que queda. Si el servidor dice que no, vuelve lo que había y se avisa.
 *
 * Un momento sin cantos no se dibuja en el repertorio, así que no se puede
 * soltar en él: para estrenar un momento se edita el canto.
 */

export type MomentoOrdenable = { codigo: string; nombre: string; cantos: string[] }

type Listas = Record<string, string[]>

const SEP = '|'
const ficha = (codigo: string, cantoId: string) => `${codigo}${SEP}${cantoId}`
const cantoDe = (f: UniqueIdentifier) => String(f).slice(String(f).lastIndexOf(SEP) + 1)
const aFichas = (listas: Listas): Listas =>
  Object.fromEntries(Object.entries(listas).map(([codigo, ids]) => [codigo, ids.map((id) => ficha(codigo, id))]))
const aCantos = (listas: Listas): Listas =>
  Object.fromEntries(Object.entries(listas).map(([codigo, fichas]) => [codigo, fichas.map(cantoDe)]))

/** La curva y la duración del producto (DESIGN.md · Motion: 150–200 ms, ease-out). */
const CURVA = 'cubic-bezier(0.22, 1, 0.36, 1)'
const DURACION = 180

function suscribirMovimiento(avisar: () => void) {
  const consulta = window.matchMedia('(prefers-reduced-motion: reduce)')
  consulta.addEventListener('change', avisar)
  return () => consulta.removeEventListener('change', avisar)
}

/** La animación de soltar la hace la librería en JS: el CSS de reduced motion no la alcanza. */
function useMovimientoReducido() {
  return useSyncExternalStore(
    suscribirMovimiento,
    () => window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    () => false
  )
}

export default function RepertorioOrdenable({
  momentos,
  filas,
}: {
  momentos: MomentoOrdenable[]
  filas: Record<string, DatosFila>
}) {
  const delServidor = useMemo(
    () => aFichas(Object.fromEntries(momentos.map((m) => [m.codigo, m.cantos]))),
    [momentos]
  )
  const [listas, setListas] = useState<Listas>(delServidor)
  const [activo, setActivo] = useState<string | null>(null)
  const [error, setError] = useState<{ codigo: string; texto: string } | null>(null)
  const [pendiente, startTransition] = useTransition()
  // La foto de cuando se levantó el canto: de dónde salió y cómo estaba todo.
  const inicio = useRef<{ de: string; listas: Listas } | null>(null)
  const reducido = useMovimientoReducido()

  const sensores = useSensors(
    // Unos pocos píxeles antes de levantar: un toque en el asa no es un arrastre.
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const nombres = useMemo(() => new Map(momentos.map((m) => [m.codigo, m.nombre])), [momentos])
  const tituloDe = (f: UniqueIdentifier) => filas[cantoDe(f)]?.titulo ?? 'el canto'

  function contenedorDe(id: UniqueIdentifier): string | null {
    const clave = String(id)
    if (clave in listas) return clave
    return Object.keys(listas).find((codigo) => listas[codigo].includes(clave)) ?? null
  }

  function alLevantar({ active }: DragStartEvent) {
    const de = contenedorDe(active.id)
    if (!de) return
    inicio.current = { de, listas: aCantos(listas) }
    setActivo(String(active.id))
    setError(null)
  }

  // Al pasar a otra sección el canto se muda ahí mientras se arrastra, para
  // que se vea dónde va a quedar.
  function alPasar({ active, over }: DragOverEvent) {
    if (!over) return
    const de = contenedorDe(active.id)
    const a = contenedorDe(over.id)
    if (!de || !a || de === a) return

    setListas((antes) => {
      const origen = antes[de]
      const destino = antes[a]
      let lugar = destino.length
      if (!(String(over.id) in antes)) {
        const i = destino.indexOf(String(over.id))
        const rect = active.rect.current.translated
        const debajo = rect ? rect.top > over.rect.top + over.rect.height / 2 : false
        if (i >= 0) lugar = i + (debajo ? 1 : 0)
      }
      return {
        ...antes,
        [de]: origen.filter((f) => f !== active.id),
        [a]: [...destino.slice(0, lugar), String(active.id), ...destino.slice(lugar)],
      }
    })
  }

  function alSoltar({ active, over }: DragEndEvent) {
    const foto = inicio.current
    inicio.current = null
    setActivo(null)
    if (!foto) return

    const a = contenedorDe(active.id)
    if (!over || !a) {
      setListas(aFichas(foto.listas))
      return
    }

    // Dentro de la misma sección, la librería solo mueve en pantalla: el
    // lugar nuevo se escribe acá.
    let lista = listas[a]
    if (contenedorDe(over.id) === a && !(String(over.id) in listas)) {
      const desde = lista.indexOf(String(active.id))
      const hasta = lista.indexOf(String(over.id))
      if (desde >= 0 && hasta >= 0 && desde !== hasta) lista = arrayMove(lista, desde, hasta)
    }

    const cantoId = cantoDe(active.id)
    const pos = lista.indexOf(String(active.id))
    // El lugar en el destino contado sin el canto (y sin su gemelo, si ya estaba ahí).
    const indice = lista.slice(0, pos).filter((f) => cantoDe(f) !== cantoId).length
    const nuevas = soltarCanto(foto.listas, { id: cantoId, de: foto.de, a, indice })

    const igual = [foto.de, a].every((c) => nuevas[c].join() === foto.listas[c].join())
    setListas(aFichas(nuevas))
    if (igual) return

    startTransition(async () => {
      const r = await soltarEnElRepertorio({ cantoId, de: foto.de, a, indice })
      if (!r.ok) {
        setListas(delServidor)
        setError({ codigo: a, texto: r.error })
      }
    })
  }

  function alCancelar() {
    const foto = inicio.current
    inicio.current = null
    setActivo(null)
    if (foto) setListas(aFichas(foto.listas))
  }

  function lugarDe(over: { id: UniqueIdentifier }) {
    const codigo = contenedorDe(over.id)
    if (!codigo) return 'ninguna sección'
    const i = listas[codigo].indexOf(String(over.id))
    return i >= 0 ? `el lugar ${i + 1} de ${nombres.get(codigo)}` : nombres.get(codigo) ?? codigo
  }

  const anuncios: Announcements = {
    onDragStart: ({ active }) => `Levantaste «${tituloDe(active.id)}».`,
    onDragOver: ({ active, over }) =>
      over
        ? `«${tituloDe(active.id)}» está sobre ${lugarDe(over)}.`
        : `«${tituloDe(active.id)}» no está sobre ninguna sección.`,
    onDragEnd: ({ active, over }) =>
      over ? `Soltaste «${tituloDe(active.id)}» en ${lugarDe(over)}.` : `Soltaste «${tituloDe(active.id)}».`,
    onDragCancel: ({ active }) => `Cancelaste. «${tituloDe(active.id)}» volvió a su lugar.`,
  }

  const caida: DropAnimation | null = reducido
    ? null
    : {
        duration: DURACION,
        easing: CURVA,
        sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.4' } } }),
      }

  const levantado = activo ? filas[cantoDe(activo)] : null

  return (
    <DndContext
      id="repertorio"
      sensors={sensores}
      collisionDetection={closestCorners}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      accessibility={{
        announcements: anuncios,
        screenReaderInstructions: {
          draggable:
            'Para mover el canto, presiona espacio o Enter, muévelo con las flechas y suéltalo con espacio o Enter. Escape cancela.',
        },
      }}
      onDragStart={alLevantar}
      onDragOver={alPasar}
      onDragEnd={alSoltar}
      onDragCancel={alCancelar}
    >
      {momentos.map((m) => (
        <Seccion key={m.codigo} codigo={m.codigo} nombre={m.nombre}>
          {error?.codigo === m.codigo && (
            <p role="alert" className="mt-2 text-sm text-peligro">
              {error.texto}
            </p>
          )}
          <SortableContext items={listas[m.codigo] ?? []} strategy={verticalListSortingStrategy}>
            <ul className="mt-1">
              {(listas[m.codigo] ?? []).map((f) => {
                const canto = filas[cantoDe(f)]
                return canto ? <FilaArrastrable key={f} ficha={f} canto={canto} quieta={pendiente} /> : null
              })}
            </ul>
          </SortableContext>
        </Seccion>
      ))}

      <DragOverlay dropAnimation={caida}>
        {levantado && (
          <FilaCanto
            como="div"
            canto={levantado}
            className="-mx-2 rounded-lg border-b-0 bg-superficie-alta px-2"
            asa={<Asa titulo={levantado.titulo} agarrado />}
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}

/** Una sección (un momento) que también recibe cantos de otras. */
function Seccion({ codigo, nombre, children }: { codigo: string; nombre: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: codigo })
  return (
    <section ref={setNodeRef} className="pt-6">
      <TituloSeccion>{nombre}</TituloSeccion>
      {children}
    </section>
  )
}

function FilaArrastrable({ ficha, canto, quieta }: { ficha: string; canto: DatosFila; quieta: boolean }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: ficha, disabled: quieta, transition: { duration: DURACION, easing: CURVA } })

  return (
    <FilaCanto
      ref={setNodeRef}
      canto={canto}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      // El hueco que deja el canto levantado: se ve, pero apagado.
      className={isDragging ? 'opacity-40' : ''}
      asa={
        <Asa
          titulo={canto.titulo}
          ref={setActivatorNodeRef}
          {...attributes}
          aria-roledescription="canto que se puede mover"
          {...listeners}
        />
      }
    />
  )
}

/**
 * El asa ⋮⋮: 44×44 y `touch-action: none` para que el navegador no la tome
 * como scroll. Solo ella levanta el canto.
 */
function Asa({
  titulo,
  agarrado = false,
  ref,
  ...resto
}: {
  titulo: string
  agarrado?: boolean
  ref?: (el: HTMLElement | null) => void
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      ref={ref}
      {...resto}
      aria-label={`Mover ${titulo}`}
      title="Arrastra para mover"
      className={`tactil inline-flex size-11 shrink-0 touch-none items-center justify-center rounded-lg text-texto-tenue hover:bg-superficie hover:text-texto aria-disabled:opacity-40 ${
        agarrado ? 'cursor-grabbing text-texto' : 'cursor-grab'
      }`}
    >
      <IconoAgarrar tamano={20} />
    </button>
  )
}
