/**
 * Misas de ejemplo — docs/PRD.md §17 (H13) y §13.4
 *
 * H13 mide el historial de ejecución, y **el historial es la celebración
 * armada en H6**: sin misas no hay nada que medir ni con qué verificar el
 * hito. §17.1-ter ya lo había anticipado ("se puede agregar a `sembrar.ts`
 * cuando estorbe"); acá estorbó.
 *
 * NOMBRES QUE SE DELATAN, a propósito. Todos empiezan con «Ejemplo ·». Dentro
 * de seis meses nadie tiene que preguntarse cuáles cantó el coro de verdad y
 * cuáles sembró una herramienta — y `db:borrar-semilla` se las lleva.
 *
 * FECHAS FIJAS Y NO RELATIVAS AL DÍA DE SIEMBRA. Relativas se verían "recientes"
 * para siempre, pero la semilla dejaría de ser idempotente: cada corrida
 * movería las fechas y el historial cambiaría solo. Fijas, dos corridas seguidas
 * dan exactamente el mismo historial, que es lo que hace verificable el hito.
 *
 * EL DISEÑO NO ES DECORATIVO: reparte los cantos para que el "listo cuando" de
 * H13 se pueda comprobar de un vistazo.
 *
 *   · «Pescador de hombres» en las cuatro  → el más cantado
 *   · «Escojo la vida» en una              → el caso de una sola vez, sin espaciado
 *   · tres cantos en NINGUNA misa pasada   → el bloque de "nunca cantados"
 *
 * Y los tres que nunca se cantaron son justamente los que están en la misa
 * FUTURA y en el ensayo SIN FECHA. Así el caso negativo —lo agendado no cuenta
 * como cantado— se ve en pantalla en vez de quedar en un test.
 */

export type CelebracionSemilla = {
  nombre: string
  /** `YYYY-MM-DD`, o null para la lista sin fecha (§18-6). */
  fecha: string | null
  /** Títulos de cantos, con el momento en que se cantaron. En orden litúrgico. */
  cantos: { titulo: string; momento: string }[]
}

export const CELEBRACIONES: CelebracionSemilla[] = [
  {
    nombre: 'Ejemplo · Misa dominical',
    fecha: '2026-05-03',
    cantos: [
      { titulo: 'Abre tu jardín', momento: 'entrada' },
      { titulo: 'Hoy perdóname', momento: 'perdon' },
      { titulo: 'El Alfarero', momento: 'ofertorio' },
      { titulo: 'Santo Gen Rosso', momento: 'santo' },
      { titulo: 'Pescador de hombres', momento: 'comunion' },
    ],
  },
  {
    nombre: 'Ejemplo · Misa dominical',
    fecha: '2026-06-07',
    cantos: [
      { titulo: 'Abre tu jardín', momento: 'entrada' },
      { titulo: 'Gloria Palazón', momento: 'gloria' },
      { titulo: 'El Alfarero', momento: 'ofertorio' },
      { titulo: 'Santo Gen Rosso', momento: 'santo' },
      { titulo: 'Pescador de hombres', momento: 'comunion' },
    ],
  },
  {
    nombre: 'Ejemplo · Misa dominical',
    fecha: '2026-07-12',
    cantos: [
      // El único canto que no sale del cancionero, cantado una sola vez: es el
      // caso de "sin espaciado que promediar" con datos reales.
      { titulo: 'Escojo la vida', momento: 'entrada' },
      { titulo: 'Salmo 23 (El Señor es mi Pastor)', momento: 'salmo' },
      { titulo: 'El Alfarero', momento: 'ofertorio' },
      { titulo: 'Santo Gen Rosso', momento: 'santo' },
      { titulo: 'Pescador de hombres', momento: 'comunion' },
    ],
  },
  {
    nombre: 'Ejemplo · Misa dominical',
    fecha: '2026-08-02',
    cantos: [
      { titulo: 'Abre tu jardín', momento: 'entrada' },
      { titulo: 'Cordero de Dios I', momento: 'cordero' },
      { titulo: 'Pescador de hombres', momento: 'comunion' },
      // Dos cantos en el mismo momento: legítimo, los separa su `orden` (§5).
      { titulo: 'Nada te turbe', momento: 'comunion' },
    ],
  },

  // --- Los dos que NO deben contar -------------------------------------------
  {
    // Agendada, no cantada. Sus dos cantos tienen que seguir apareciendo como
    // "nunca se cantó" mientras la fecha no llegue.
    nombre: 'Ejemplo · Misa agendada',
    fecha: '2026-09-20',
    cantos: [
      { titulo: 'Donde hay amor', momento: 'antifona' },
      { titulo: 'Reina del Cielo', momento: 'maria' },
    ],
  },
  {
    // Sin fecha: es una lista de trabajo, no una misa (§18-6). Nunca ocurrió.
    nombre: 'Ejemplo · Ensayo sin fecha',
    fecha: null,
    cantos: [{ titulo: 'Himno Misión País', momento: 'himno' }],
  },
]
