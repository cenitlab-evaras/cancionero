import { etiquetaTesitura, TESITURAS } from './ficha'

/**
 * La inscripción de una persona a una misa — H15, docs/PRD.md §17 y §19.2-B2.
 *
 * Función PURA y sin datos: la comparten la pantalla de la misa y la server
 * action, para que el texto que se ve y la regla que se aplica sean el mismo.
 *
 * Esto NO es seguridad. Quién puede inscribirse lo decide `permisos.ts` y lo
 * hace cumplir `misa_participante_write` —`perfil_id = auth.uid()`—, que es la
 * primera política del producto donde un miembro escribe en dato que el coro
 * entero lee (§19.5).
 *
 * SOBRE EL VOCABULARIO: el aporte es `vocal` o `instrumental`, y no «voz» ni
 * «canto». §19.4 prohíbe «voz» como nombre de nada —en el habla del coro
 * significa a la vez la tesitura y la pista grabada— y «canto» ya es la otra
 * tabla del producto.
 */

/** Con qué va alguien a la misa. El segundo pide decir CUÁL (§19.2-B2). */
export const APORTES = ['vocal', 'instrumental'] as const
export type Aporte = (typeof APORTES)[number]

/**
 * Lista cerrada y no texto libre.
 *
 * Con quince personas, «guitarra», «Guitarra» y «guita» serían tres
 * instrumentos distintos en el resumen, que es justo lo que el resumen existe
 * para evitar. `otro` es la válvula: si empieza a usarse seguido, el arreglo es
 * un catálogo como el de momentos, no agregar filas acá para siempre.
 */
export const INSTRUMENTOS = [
  'guitarra',
  'teclado',
  'bajo',
  'percusion',
  'flauta',
  'violin',
  'otro',
] as const
export type Instrumento = (typeof INSTRUMENTOS)[number]

const NOMBRES: Record<Instrumento, string> = {
  guitarra: 'Guitarra',
  teclado: 'Teclado',
  bajo: 'Bajo',
  percusion: 'Percusión',
  flauta: 'Flauta',
  violin: 'Violín',
  otro: 'Otro',
}

export type Inscrito = {
  perfilId: string
  nombre: string | null
  aporte: Aporte
  instrumento: string | null
}

export function esAporteValido(valor: unknown): valor is Aporte {
  return typeof valor === 'string' && (APORTES as readonly string[]).includes(valor)
}

export function esInstrumentoValido(valor: unknown): valor is Instrumento {
  return typeof valor === 'string' && (INSTRUMENTOS as readonly string[]).includes(valor)
}

/** El texto del instrumento, o el crudo si viniera algo desconocido de la base. */
export function nombreInstrumento(valor: string | null): string {
  if (!valor) return ''
  return esInstrumentoValido(valor) ? NOMBRES[valor] : valor
}

export function etiquetaAporte(aporte: Aporte): string {
  return aporte === 'vocal' ? 'Canta' : 'Toca'
}

export type ResultadoInscripcion =
  | { ok: true; limpio: { aporte: Aporte; instrumento: Instrumento | null } }
  | { ok: false; error: string }

/**
 * El aporte es UN campo condicional, no dos sueltos (§19.2-B2).
 *
 * Espejo del `check` de la migración, del lado del mensaje: la base impide la
 * fila incoherente, y esto explica por qué. Sin este espejo, elegir «toco» sin
 * decir qué se toca devolvería el error crudo de Postgres, que no le dice nada
 * a nadie.
 *
 * Marcar «canto» con un instrumento ya elegido NO es un error: es alguien que
 * cambió de idea. Se limpia y se guarda, porque rechazarlo sería castigar el
 * caso más común de la pantalla.
 */
export function validarInscripcion(entrada: {
  aporte: unknown
  instrumento: unknown
}): ResultadoInscripcion {
  if (!esAporteValido(entrada.aporte)) {
    return { ok: false, error: 'Elige si vas a cantar o a tocar.' }
  }

  if (entrada.aporte === 'vocal') {
    return { ok: true, limpio: { aporte: 'vocal', instrumento: null } }
  }

  if (entrada.instrumento === null || entrada.instrumento === undefined || entrada.instrumento === '') {
    return { ok: false, error: 'Dinos qué instrumento vas a tocar.' }
  }
  if (!esInstrumentoValido(entrada.instrumento)) {
    return { ok: false, error: 'Ese instrumento no está en la lista.' }
  }

  return { ok: true, limpio: { aporte: 'instrumental', instrumento: entrada.instrumento } }
}

export type DatoDePerfil = {
  perfilId: string
  tesitura: string | null
  disponibilidad: string | null
}

export type ResumenDelCoro = {
  total: number
  voces: { tesitura: string | null; cuantos: number }[]
  instrumentos: { instrumento: string | null; cuantos: number }[]
}

/**
 * Con qué se cuenta para esta misa.
 *
 * La tesitura se lee del PERFIL (H14) y no de la inscripción: es un dato de la
 * persona, no de la misa, y pedirlo de nuevo cada domingo crearía dos verdades
 * que algún día se contradicen.
 *
 * Quien se anotó para TOCAR no se cuenta como voz aunque su perfil declare una.
 * El resumen contesta «con qué contamos el domingo», no «qué sabe hacer la
 * gente».
 */
export function resumirCoro(inscritos: Inscrito[], perfiles: DatoDePerfil[]): ResumenDelCoro {
  const tesituraDe = new Map(perfiles.map((p) => [p.perfilId, p.tesitura]))

  const voces = new Map<string | null, number>()
  const instrumentos = new Map<string | null, number>()

  for (const i of inscritos) {
    if (i.aporte === 'vocal') {
      const t = tesituraDe.get(i.perfilId) ?? null
      voces.set(t, (voces.get(t) ?? 0) + 1)
    } else {
      instrumentos.set(i.instrumento, (instrumentos.get(i.instrumento) ?? 0) + 1)
    }
  }

  // De aguda a grave, como `ordenarPorTesitura` en H14, y con la no declarada
  // al final: el coro se lee así, no en el orden en que la gente se anotó.
  const orden = (t: string | null) => {
    const i = (TESITURAS as readonly string[]).indexOf(t ?? '')
    return i === -1 ? TESITURAS.length : i
  }

  return {
    total: inscritos.length,
    voces: [...voces.entries()]
      .map(([tesitura, cuantos]) => ({ tesitura, cuantos }))
      .sort((a, b) => orden(a.tesitura) - orden(b.tesitura)),
    instrumentos: [...instrumentos.entries()]
      .map(([instrumento, cuantos]) => ({ instrumento, cuantos }))
      .sort((a, b) => b.cuantos - a.cuantos),
  }
}

export type Faltante = {
  perfilId: string
  nombre: string | null
  disponibilidad: string | null
}

/**
 * Quién del coro todavía no dijo nada, con su disponibilidad al lado.
 *
 * ACÁ SE CIERRA LA TENSIÓN QUE B2 DEJÓ ABIERTA (§18-11). La inscripción es una
 * declaración por misa que hace la persona; la disponibilidad es una predicción
 * general que cargó en su perfil. La pregunta era cuál manda si se contradicen,
 * y la respuesta es que **no se contradicen nunca**: en cuanto alguien se
 * anota, sale de esta lista y su predicción deja de mostrarse. La predicción
 * solo habla de quien todavía no habló.
 *
 * Alguien inscrito que ya no es del coro simplemente no aparece: la lista se
 * arma desde los miembros, no desde las inscripciones.
 */
export function quienFalta(
  miembros: { perfilId: string; nombre: string | null }[],
  inscritos: Inscrito[],
  perfiles: DatoDePerfil[]
): Faltante[] {
  const yaDijeron = new Set(inscritos.map((i) => i.perfilId))
  const disponibilidadDe = new Map(perfiles.map((p) => [p.perfilId, p.disponibilidad]))

  return miembros
    .filter((m) => !yaDijeron.has(m.perfilId))
    .map((m) => ({
      perfilId: m.perfilId,
      nombre: m.nombre,
      disponibilidad: disponibilidadDe.get(m.perfilId) ?? null,
    }))
}

/**
 * Si todavía se puede decir que uno va.
 *
 * EL CRITERIO SE SEPARA A PROPÓSITO DEL DE `agenda.ts` Y EL HISTORIAL, que
 * cuentan el día de hoy como ya ocurrido. Esos contestan «¿se cantó?»; este
 * contesta «¿todavía puedo anotarme?», y el domingo a las nueve de la mañana la
 * respuesta es que sí. Cerrar la inscripción a medianoche dejaría afuera justo
 * a quien decide el mismo día, que es como se decide en un coro.
 *
 * Una lista sin fecha (§18-6) siempre acepta: no vence nunca.
 */
export function sePuedeInscribir(fecha: string | null, hoy: string): boolean {
  return fecha === null || fecha >= hoy
}

/**
 * Los plurales, escritos uno por uno y no sacados con una regla.
 *
 * En español estos son irregulares donde más duele: «tenor» → «tenores»,
 * «violín» → «violines», «percusión» → «percusiones». Agregar una «s» daría
 * «tenors» y «violíns». Un mapa es más largo que una regla y es el único que
 * acierta siempre.
 */
const PLURAL_TESITURA: Record<string, string> = {
  soprano: 'sopranos',
  mezzosoprano: 'mezzosopranos',
  contralto: 'contraltos',
  tenor: 'tenores',
  baritono: 'barítonos',
  bajo: 'bajos',
}

const PLURAL_INSTRUMENTO: Record<Instrumento, string> = {
  guitarra: 'guitarras',
  teclado: 'teclados',
  bajo: 'bajos',
  percusion: 'percusiones',
  flauta: 'flautas',
  violin: 'violines',
  otro: 'otros',
}

/**
 * «3 tenores», «1 canta».
 *
 * Sin tesitura declarada se dice lo que la persona HACE y no lo que le falta:
 * «1 canta», no «1 sin declarar». Lo que el director necesita del resumen es
 * con qué cuenta el domingo; que a alguien le falte cargar su perfil es un
 * problema de otra pantalla.
 */
export function contarVoces(tesitura: string | null, cuantos: number): string {
  if (!tesitura) return `${cuantos} ${cuantos === 1 ? 'canta' : 'cantan'}`
  const nombre =
    cuantos === 1 ? etiquetaTesitura(tesitura).toLowerCase() : (PLURAL_TESITURA[tesitura] ?? tesitura)
  return `${cuantos} ${nombre}`
}

/** «2 guitarras». Un instrumento desconocido se dice tal cual, sin romper la frase. */
export function contarInstrumento(instrumento: string | null, cuantos: number): string {
  if (!instrumento) return `${cuantos}`
  const nombre =
    cuantos === 1
      ? nombreInstrumento(instrumento).toLowerCase()
      : esInstrumentoValido(instrumento)
        ? PLURAL_INSTRUMENTO[instrumento]
        : instrumento
  return `${cuantos} ${nombre}`
}
