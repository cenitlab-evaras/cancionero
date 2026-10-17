/**
 * H28 · La partitura en otro tono: Verovio la vuelve a dibujar en el teléfono
 * desde la fuente MusicXML, y de su mapa de tiempos sale la misma sincronía que
 * la de MuseScore (notas, cursor, velos), para que el reproductor la siga igual.
 *
 * Los tiempos calzan con las pistas: los 392 ataques de «Cantaré por siempre»
 * caen en los mismos milisegundos que la sincronía de MuseScore (17-10-2026),
 * porque los dos leen el mismo ♩ de la fuente.
 *
 * Verovio pesa 7 MB (el wasm va adentro): se baja solo al cambiar de tono, desde
 * `public/vendor/` (lo copia `scripts/copiar-vendor.mjs`), sin empaquetarlo.
 */
import { ACTIVA, CURSOR, ESPACIO_MUSESCORE, type Elemento, type Hoja, type Momento, type Pagina } from './hoja'

const SVG = 'http://www.w3.org/2000/svg'

/** Lo que se usa de `VerovioToolkit` (el paquete no trae tipos). */
type Toolkit = {
  setOptions(opciones: Record<string, unknown>): void
  loadData(datos: string): boolean
  getPageCount(): number
  renderToSVG(pagina: number): string
  renderToMIDI(): string
  renderToTimemap(opciones?: Record<string, unknown>): { tstamp: number; on?: string[]; off?: string[] }[]
}

let cargando: Promise<Toolkit> | null = null

function verovio(): Promise<Toolkit> {
  cargando ??= (async () => {
    // Rutas en variables y sin empaquetar: el módulo trae una rama para Node que
    // el empaquetador del navegador no tiene que resolver.
    const urlModulo = '/vendor/verovio-module.mjs'
    const urlToolkit = '/vendor/verovio-toolkit.mjs'
    const [modulo, envoltorio] = await Promise.all([
      import(/* turbopackIgnore: true */ /* webpackIgnore: true */ urlModulo),
      import(/* turbopackIgnore: true */ /* webpackIgnore: true */ urlToolkit),
    ])
    return new envoltorio.VerovioToolkit(await modulo.default()) as Toolkit
  })()
  // Si falló (sin red), el próximo intento vuelve a bajarlo.
  cargando.catch(() => {
    cargando = null
  })
  return cargando
}

/** Las cinco líneas de un pentagrama de Verovio: `M x1 y L x2 y`. */
function lineas(staff: Element): { x0: number; x1: number; ys: number[] } {
  const ds = [...staff.children]
    .filter((c) => c.tagName === 'path')
    .map((c) => /M(-?[\d.]+) (-?[\d.]+) L(-?[\d.]+)/.exec(c.getAttribute('d') ?? ''))
    .filter((m): m is RegExpExecArray => m !== null)
    .slice(0, 5)
  return { x0: Number(ds[0]?.[1] ?? 0), x1: Number(ds[0]?.[3] ?? 0), ys: ds.map((m) => Number(m[2])) }
}

/**
 * Dibuja la partitura transpuesta en `contenedor` y la une con el tiempo.
 * `transponer` es la opción de Verovio («+M2»; ver `intervaloParaTransponer`).
 */
export async function prepararHojaVerovio(contenedor: HTMLElement, xml: string, transponer: string): Promise<Hoja> {
  const tk = await verovio()
  tk.setOptions({
    transpose: transponer,
    svgViewBox: true,
    adjustPageHeight: true,
    breaks: 'auto',
    footer: 'none',
    // El número de pentagrama en el SVG: es la cuerda (staff 1 = la primera parte).
    svgAdditionalAttribute: ['staff@n'],
  })
  if (!tk.loadData(xml)) throw new Error('Verovio no pudo leer la partitura')
  const svgs = Array.from({ length: tk.getPageCount() }, (_, i) => tk.renderToSVG(i + 1))
  tk.renderToMIDI() // el mapa de tiempos lo necesita
  const tiempos = tk.renderToTimemap()

  contenedor.replaceChildren()
  const paginas: Pagina[] = []
  const notas = new Map<string, { nodo: SVGGElement; p: number }>()
  // Por página: sus sistemas, con el borde de sus pentagramas (para el cursor).
  const sistemas = new Map<Element, { y: number; h: number; x1: number }>()

  svgs.forEach((marcado, p) => {
    const div = document.createElement('div')
    div.className = 'pagina-partitura'
    // Lo dibujó Verovio, en este teléfono, desde la fuente del bucket que solo
    // escribe la clave de servicio (§21.5): no es texto de un usuario.
    div.innerHTML = marcado
    contenedor.append(div)
    const svg = div.querySelector('svg')!
    const capa = svg.querySelector<SVGGElement>('g.page-margin')!

    const primero = lineas(capa.querySelector('g.staff')!)
    const espacio = primero.ys.length > 1 ? primero.ys[1] - primero.ys[0] : ESPACIO_MUSESCORE
    const k = espacio / ESPACIO_MUSESCORE

    const marca = document.createElementNS(SVG, 'rect')
    marca.setAttribute('fill', CURSOR)
    marca.setAttribute('fill-opacity', '0.12')
    marca.setAttribute('rx', String(40 * k))
    marca.style.display = 'none'
    capa.prepend(marca) // bajo todo lo demás

    // Un velo por pentagrama, sistema por sistema y de arriba abajo, como en la
    // hoja de MuseScore: el i-ésimo es la cuerda i módulo las cuerdas.
    const velos: SVGRectElement[] = []
    for (const sistema of capa.querySelectorAll('g.system')) {
      const pent = [...sistema.querySelectorAll('g.staff')].map(lineas).filter((l) => l.ys.length === 5)
      if (pent.length === 0) continue
      sistemas.set(sistema, {
        y: pent[0].ys[0],
        h: pent[pent.length - 1].ys[4] - pent[0].ys[0],
        x1: pent[0].x1,
      })
      pent.forEach((l, i) => {
        const arriba = l.ys[0]
        const abajo = l.ys[4]
        const y0 = i === 0 ? arriba - 450 * k : (pent[i - 1].ys[4] + arriba) / 2 + 150 * k
        const y1 = i === pent.length - 1 ? abajo + 650 * k : (abajo + pent[i + 1].ys[0]) / 2 + 150 * k
        const r = document.createElementNS(SVG, 'rect')
        // De borde a borde de la hoja, con el nombre de la cuerda incluido (la
        // capa está corrida por el margen de la página: se parte de antes de 0).
        r.setAttribute('x', String(-l.x0))
        r.setAttribute('width', String(l.x1 + 2 * l.x0))
        r.setAttribute('y', String(y0))
        r.setAttribute('height', String(y1 - y0))
        r.setAttribute('fill', '#fff')
        r.setAttribute('fill-opacity', '0.72')
        r.style.pointerEvents = 'none'
        r.style.display = 'none'
        capa.append(r)
        velos.push(r)
      })
    }

    // La sílaba va dentro de su nota: se enciende con ella, con un trazo de letra.
    for (const syl of capa.querySelectorAll('g.syl')) syl.setAttribute('stroke-width', String(10 * k))
    for (const n of capa.querySelectorAll<SVGGElement>('g.note')) notas.set(n.id, { nodo: n, p })

    paginas.push({ div, svg, capa, escala: k, marca, velos })
  })

  // Cuándo empieza y termina cada nota.
  const inicio = new Map<string, number>()
  const fin = new Map<string, number>()
  for (const e of tiempos) {
    for (const id of e.on ?? []) inicio.set(id, e.tstamp)
    for (const id of e.off ?? []) fin.set(id, e.tstamp)
  }

  const elementos: Elemento[] = []
  const centro = new Map<string, { x: number; y: number }>()
  for (const [id, t0] of inicio) {
    const n = notas.get(id)
    if (!n) continue
    const pg = paginas[n.p]
    const cabeza = (n.nodo.querySelector<SVGGraphicsElement>('g.notehead') ?? n.nodo).getBBox()
    const c = { x: cabeza.x + cabeza.width / 2, y: cabeza.y + cabeza.height / 2 }
    centro.set(id, { x: cabeza.x, y: c.y })
    const halo = document.createElementNS(SVG, 'circle')
    halo.setAttribute('cx', String(c.x))
    halo.setAttribute('cy', String(c.y))
    halo.setAttribute('r', String(150 * pg.escala))
    halo.setAttribute('fill', ACTIVA)
    halo.setAttribute('fill-opacity', '0.28')
    halo.style.display = 'none'
    pg.marca.after(halo)
    const staff = n.nodo.closest<SVGGElement>('g.staff')
    elementos.push({
      p: n.p,
      k: 'n',
      i: 0,
      s: Number(staff?.dataset.n ?? 1) - 1,
      t0,
      t1: fin.get(id) ?? t0,
      nodo: n.nodo,
      halo,
      trazo: 18 * pg.escala,
      activa: null,
    })
  }

  // El cursor: un momento por cada ataque, desde la primera cabeza que suena
  // hasta la del momento siguiente en el mismo sistema (o el final del sistema).
  const cursor: (Momento & { sistema: Element })[] = []
  for (const e of tiempos) {
    const ids = (e.on ?? []).filter((id) => centro.has(id))
    if (ids.length === 0) continue
    const { nodo, p } = notas.get(ids[0])!
    const sistema = nodo.closest('g.system')
    const borde = sistema && sistemas.get(sistema)
    if (!sistema || !borde) continue
    const x = Math.min(...ids.map((id) => centro.get(id)!.x))
    cursor.push({ p, x, w: 0, y: borde.y, h: borde.h, t: e.tstamp, sistema })
  }
  cursor.forEach((c, i) => {
    const siguiente = cursor[i + 1]
    const derecha = siguiente && siguiente.sistema === c.sistema ? siguiente.x : sistemas.get(c.sistema)!.x1
    c.w = Math.max(derecha - c.x, 100 * paginas[c.p].escala)
  })

  return { paginas, elementos, cursor: cursor.map((c) => ({ p: c.p, x: c.x, w: c.w, y: c.y, h: c.h, t: c.t })) }
}
