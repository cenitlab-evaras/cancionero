/**
 * La partitura en papel que sigue la música — el DOM, portado de
 * `escuchar.html` (PRD §21.1: su conducta manda).
 *
 * Acá no hay reglas: cuál nota suena y dónde va el cursor lo deciden
 * `lib/motores/seguimiento.ts` y `mezcla.ts`. Esto solo prepara el SVG que
 * dibujó MuseScore y lo pinta.
 *
 * Los colores de acá son los del PAPEL, no de la app (§21.8: «notas negras sobre
 * blanco, como las dibuja MuseScore, sin recolorear el SVG»): la tinta, el
 * naranjo de la nota que suena y el halo del cursor son los de `escuchar.html`
 * y del video exportado, para que el coro vea lo mismo en los dos lados.
 */

export const TINTA = '#1a1a1a'
export const ACTIVA = '#d2691e'
export const CURSOR = '#e8a54b'
const SVG = 'http://www.w3.org/2000/svg'

export type DatosPartitura = {
  paginas: string[]
  /** p: página · k: 'n' nota o sílaba · i: índice del nodo · s: pentagrama · t0/t1 en ms */
  elementos: { p: number; k: string; i: number; s: number; t0: number; t1: number }[]
  cursor: { p: number; x: number; w: number; y: number; h: number; t: number }[]
  fin: number
}

export type Momento = DatosPartitura['cursor'][number]

export type Pagina = {
  div: HTMLDivElement
  svg: SVGSVGElement
  /**
   * Donde viven las notas y lo que se les dibuja encima (franja, halos, velos),
   * en sus coordenadas. En el SVG de MuseScore es el propio <svg>; en el de
   * Verovio (H28), el <g class="page-margin">.
   */
  capa: SVGGraphicsElement
  /** Cuánto mide el espacio entre líneas del pentagrama respecto del de MuseScore. */
  escala: number
  marca: SVGRectElement
  velos: SVGRectElement[]
}

export type Elemento = DatosPartitura['elementos'][number] & {
  nodo: SVGElement
  halo: SVGCircleElement | null
  /** El grosor del trazo encendido, en las unidades de su hoja. */
  trazo: number
  activa: boolean | null
}

/** Una partitura lista para seguir la música, la dibuje quien la dibuje. */
export type Hoja = { paginas: Pagina[]; elementos: Elemento[]; cursor: Momento[] }

/** El espacio entre líneas del pentagrama en el SVG de MuseScore. */
export const ESPACIO_MUSESCORE = 68

/**
 * Ajusta la hoja a lo que tiene dibujado, sin el blanco sobrante. Las piezas con
 * transform (cabezas de nota) se saltan: su getBBox viene en coordenadas
 * locales; pentagramas y letra ya marcan el borde.
 */
function recortar(svg: SVGSVGElement) {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const piezas = [...svg.querySelectorAll<SVGGraphicsElement>('path, polyline')].slice(1) // el primero es el papel
  for (const p of piezas) {
    if (p.hasAttribute('transform')) continue
    const b = p.getBBox()
    if (!b.width && !b.height) continue
    x0 = Math.min(x0, b.x)
    y0 = Math.min(y0, b.y)
    x1 = Math.max(x1, b.x + b.width)
    y1 = Math.max(y1, b.y + b.height)
  }
  if (!Number.isFinite(x0)) return
  const m = 250
  svg.setAttribute('viewBox', `${x0 - m} ${y0 - m} ${x1 - x0 + 2 * m} ${y1 - y0 + 2 * m}`)
}

/**
 * Un velo blanco por pentagrama (con su letra) para apagar entera la cuerda que
 * no suena: plicas, corchetes, silencios y sílabas incluidos, no solo las
 * cabezas de nota.
 */
function velos(svg: SVGSVGElement): SVGRectElement[] {
  const ys = [
    ...new Set(
      [...svg.querySelectorAll('polyline.StaffLines')].map(
        (l) => +(l.getAttribute('points') ?? '0,0').split(/[ ,]/)[1]
      )
    ),
  ].sort((a, b) => a - b)
  const pent: [number, number][] = []
  for (let i = 0; i + 4 < ys.length; i += 5) pent.push([ys[i], ys[i + 4]])
  const vb = svg.viewBox.baseVal
  return pent.map(([arriba, abajo], i) => {
    const y0 = i === 0 ? arriba - 450 : (pent[i - 1][1] + arriba) / 2 + 150
    const y1 = i === pent.length - 1 ? abajo + 650 : (abajo + pent[i + 1][0]) / 2 + 150
    const r = document.createElementNS(SVG, 'rect')
    r.setAttribute('x', String(vb.x))
    r.setAttribute('width', String(vb.width))
    r.setAttribute('y', String(y0))
    r.setAttribute('height', String(y1 - y0))
    r.setAttribute('fill', '#fff')
    r.setAttribute('fill-opacity', '0.72')
    r.style.pointerEvents = 'none'
    r.style.display = 'none'
    svg.append(r)
    return r
  })
}

/** Inserta las páginas en `contenedor` y une la sincronía con sus nodos. */
export function prepararHoja(contenedor: HTMLElement, datos: DatosPartitura): Hoja {
  contenedor.replaceChildren()
  const paginas: Pagina[] = datos.paginas.map((marcado) => {
    const div = document.createElement('div')
    div.className = 'pagina-partitura'
    // El SVG lo dibujó MuseScore en el conversor y vive en un bucket que solo
    // escribe la clave de servicio (§21.5): no es texto de un usuario.
    div.innerHTML = marcado
    contenedor.append(div)
    const svg = div.querySelector('svg')!
    svg.removeAttribute('width')
    svg.removeAttribute('height')
    recortar(svg)
    const marca = document.createElementNS(SVG, 'rect')
    marca.setAttribute('fill', CURSOR)
    marca.setAttribute('fill-opacity', '0.12')
    marca.setAttribute('rx', '40')
    marca.style.display = 'none'
    svg.querySelector('path')!.after(marca) // sobre el papel, bajo todo lo demás
    return { div, svg, capa: svg, escala: 1, marca, velos: velos(svg) }
  })

  const nodos = paginas.map((pg) => ({
    notas: pg.svg.querySelectorAll<SVGElement>('path.Note'),
    silabas: pg.svg.querySelectorAll<SVGElement>('path.Lyrics'),
  }))

  const elementos: Elemento[] = []
  for (const e of datos.elementos) {
    const nodo = (e.k === 'n' ? nodos[e.p].notas : nodos[e.p].silabas)[e.i]
    if (!nodo) continue
    let halo: SVGCircleElement | null = null
    // La cabeza de nota sola es muy chica para seguirla de reojo: lleva un halo
    // detrás que se enciende mientras suena.
    if (e.k === 'n') {
      const bb = (nodo as unknown as SVGGraphicsElement).getBBox()
      const m = (nodo as unknown as SVGGraphicsElement).transform.baseVal.consolidate()
      const c = new DOMPoint(bb.x + bb.width / 2, bb.y + bb.height / 2).matrixTransform(
        m ? m.matrix : new DOMMatrix()
      )
      halo = document.createElementNS(SVG, 'circle')
      halo.setAttribute('cx', String(c.x))
      halo.setAttribute('cy', String(c.y))
      halo.setAttribute('r', '150')
      halo.setAttribute('fill', ACTIVA)
      halo.setAttribute('fill-opacity', '0.28')
      halo.style.display = 'none'
      paginas[e.p].marca.after(halo)
    }
    elementos.push({ ...e, nodo, halo, trazo: e.k === 'n' ? 18 : 10, activa: null })
  }
  return { paginas, elementos, cursor: datos.cursor }
}

/** Enciende o apaga una nota o sílaba: naranjo y más gruesa, con su halo. */
export function pintarElemento(e: Elemento, activa: boolean) {
  if (activa === e.activa) return
  e.nodo.setAttribute('fill', activa ? ACTIVA : TINTA)
  e.nodo.setAttribute('stroke', activa ? ACTIVA : 'none')
  e.nodo.setAttribute('stroke-width', activa ? String(e.trazo) : '0')
  if (e.halo) e.halo.style.display = activa ? '' : 'none'
  e.activa = activa
}

/** La franja del cursor sobre el momento que suena, o nada. */
export function moverMarca(paginas: Pagina[], c: Momento | null) {
  paginas.forEach((pg, i) => {
    pg.marca.style.display = c && c.p === i ? '' : 'none'
  })
  if (!c) return
  const { marca: m, escala: k } = paginas[c.p]
  m.setAttribute('x', String(c.x - 40 * k))
  m.setAttribute('y', String(c.y - 300 * k))
  m.setAttribute('width', String(c.w))
  m.setAttribute('height', String(c.h + 600 * k))
}

/**
 * Pantalla angosta: la hoja no se encoge más, se corre hacia el lado para
 * mantener el cursor a la vista (entre el 10 % y el 70 % del ancho).
 */
export function seguirConLaVista(pg: Pagina, x: number, suave: boolean) {
  const { div, capa } = pg
  if (div.scrollWidth <= div.clientWidth) return
  const ctm = capa.getScreenCTM()
  if (!ctm) return
  // De la capa a la pantalla, y de ahí al comienzo (con lo corrido) de la hoja.
  const px = new DOMPoint(x, 0).matrixTransform(ctm).x - div.getBoundingClientRect().left + div.scrollLeft
  if (px < div.scrollLeft + div.clientWidth * 0.1 || px > div.scrollLeft + div.clientWidth * 0.7) {
    div.scrollTo({ left: px - div.clientWidth * 0.25, behavior: suave ? 'smooth' : 'auto' })
  }
}

/**
 * Con la música andando, el sistema que suena tiene que verse: si la franja
 * del cursor quedó tapada por la cabecera de arriba o por la barra de abajo
 * (`arriba` y `abajo`, en px de la ventana), la página baja (o sube) hasta
 * dejarla a la vista; si es más alta que lo visible, con su borde de arriba
 * junto a la cabecera. Devuelve si movió la página. Antes solo se movía al cambiar de PÁGINA,
 * y con dos sistemas por página la música seguía fuera de la pantalla.
 */
export function mantenerALaVista(marca: SVGRectElement, arriba: number, abajo: number, suave: boolean): boolean {
  const r = marca.getBoundingClientRect()
  const visible = abajo - arriba
  const cabe = r.height <= visible
  // Si cabe, basta con que se vea entero; si no cabe (seis voces en un
  // teléfono), basta con que su borde de arriba esté cerca de la cabecera.
  const bien = cabe ? r.top >= arriba && r.bottom <= abajo : Math.abs(r.top - arriba) < visible * 0.15
  if (bien) return false
  const margen = cabe ? Math.min(visible * 0.2, visible - r.height) : 0
  window.scrollBy({ top: r.top - arriba - margen, behavior: suave ? 'smooth' : 'auto' })
  return true
}

/** El momento de la partitura bajo un toque, en ms, o null si no cae en ninguno. */
export function momentoBajoElToque(
  pg: Pagina,
  p: number,
  cursor: Momento[],
  clientX: number,
  clientY: number
): number | null {
  const ctm = pg.capa.getScreenCTM()
  if (!ctm) return null
  const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse())
  const c = cursor.find((c) => c.p === p && pt.x >= c.x && pt.x < c.x + c.w)
  return c ? c.t : null
}
