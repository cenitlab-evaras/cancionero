/**
 * Catálogo de digitaciones de guitarra en afinación estándar (H5 · PRD §3.2).
 *
 * Es un DATO, no una dependencia de render ni una tabla: `C` se toca `x32010`
 * para todos los coros, hoy y siempre. No cuelga de ningún `coro_id`, así que
 * no hay nada que una política de RLS pudiera decidir. Vive versionado en
 * código, donde se revisa en el diff.
 *
 * **Notación.** Seis caracteres, de la 6ª cuerda (mi grave) a la 1ª (mi aguda):
 * `x` cuerda muda · `0` al aire · `1`–`9` traste ABSOLUTO. Es la notación que un
 * guitarrista lee y corrige de un vistazo —`x32010` se revisa, `[null,3,2,0,1,0]`
 * se audita— y hace que el invariante del PRD §9 sea literal en el test.
 *
 * Los trastes son absolutos a propósito: autorar relativo a una posición es una
 * fábrica de errores de aritmética a mano. La ventana que dibuja el diagrama se
 * DERIVA en `buscar-digitacion.ts` y está probada.
 *
 * **Cobertura: 12 raíces × 4 sufijos = 48.** Las raíces van en sostenidos
 * porque `transponer` siempre emite sostenidos. Los sufijos son exactamente los
 * que el repertorio usa sin bajo (`""`, `m`, `7`, `m7`), y eso basta para
 * cubrirlo entero en las 23 transposiciones: `transponerAcorde` preserva el
 * sufijo y solo rota la raíz. El test de cobertura lo comprueba a mano armada.
 *
 * **Qué NO está, con su razón:**
 * - `sus4`, `maj7`, `dim`, `aug`: ningún cifrado sembrado los usa. El día que
 *   H8 permita escribirlos, el test de cobertura se pone rojo solo y avisa.
 * - El sufijo `9`: en la semilla aparece únicamente dentro de `A9/C#`, y los
 *   acordes con bajo devuelven `null` por decisión (ver `buscar-digitacion.ts`).
 * - Digitaciones alternativas y otras afinaciones: PRD §16, explícito.
 */

export type Digitacion = {
  /** Seis caracteres, de la 6ª cuerda a la 1ª. `x` muda · `0` al aire · `1`-`9` traste. */
  cuerdas: string
  /** Cejilla. `desde`/`hasta` son índices de `cuerdas` (0 = 6ª … 5 = 1ª). */
  cejilla?: { traste: number; desde: number; hasta: number }
}

export type Catalogo = Record<string, Digitacion>

/** Cejilla que cruza las seis cuerdas (formas de mi). */
const seis = (traste: number) => ({ traste, desde: 0, hasta: 5 })
/** Cejilla desde la 5ª cuerda (formas de la); la 6ª va muda. */
const cinco = (traste: number) => ({ traste, desde: 1, hasta: 5 })

export const DIGITACIONES: Catalogo = {
  // ── Mayores ────────────────────────────────────────────────────────────────
  C: { cuerdas: 'x32010' },
  'C#': { cuerdas: 'x46664', cejilla: cinco(4) },
  D: { cuerdas: 'xx0232' },
  'D#': { cuerdas: 'xx1343' },
  E: { cuerdas: '022100' },
  F: { cuerdas: '133211', cejilla: seis(1) },
  'F#': { cuerdas: '244322', cejilla: seis(2) },
  G: { cuerdas: '320003' },
  'G#': { cuerdas: '466544', cejilla: seis(4) },
  A: { cuerdas: 'x02220' },
  'A#': { cuerdas: 'x13331', cejilla: cinco(1) },
  B: { cuerdas: 'x24442', cejilla: cinco(2) },

  // ── Menores ────────────────────────────────────────────────────────────────
  Cm: { cuerdas: 'x35543', cejilla: cinco(3) },
  'C#m': { cuerdas: 'x46654', cejilla: cinco(4) },
  Dm: { cuerdas: 'xx0231' },
  'D#m': { cuerdas: 'xx1342' },
  Em: { cuerdas: '022000' },
  Fm: { cuerdas: '133111', cejilla: seis(1) },
  'F#m': { cuerdas: '244222', cejilla: seis(2) },
  Gm: { cuerdas: '355333', cejilla: seis(3) },
  'G#m': { cuerdas: '466444', cejilla: seis(4) },
  Am: { cuerdas: 'x02210' },
  'A#m': { cuerdas: 'x13321', cejilla: cinco(1) },
  Bm: { cuerdas: 'x24432', cejilla: cinco(2) },

  // ── Séptimas de dominante ──────────────────────────────────────────────────
  C7: { cuerdas: 'x32310' },
  'C#7': { cuerdas: 'x46464', cejilla: cinco(4) },
  D7: { cuerdas: 'xx0212' },
  'D#7': { cuerdas: 'xx1323' },
  E7: { cuerdas: '020100' },
  F7: { cuerdas: '131211', cejilla: seis(1) },
  'F#7': { cuerdas: '242322', cejilla: seis(2) },
  G7: { cuerdas: '320001' },
  'G#7': { cuerdas: '464544', cejilla: seis(4) },
  A7: { cuerdas: 'x02020' },
  'A#7': { cuerdas: 'x13131', cejilla: cinco(1) },
  B7: { cuerdas: 'x21202' },

  // ── Menores con séptima ────────────────────────────────────────────────────
  Cm7: { cuerdas: 'x35343', cejilla: cinco(3) },
  'C#m7': { cuerdas: 'x46454', cejilla: cinco(4) },
  Dm7: { cuerdas: 'xx0211' },
  'D#m7': { cuerdas: 'xx1322' },
  Em7: { cuerdas: '020000' },
  Fm7: { cuerdas: '131111', cejilla: seis(1) },
  'F#m7': { cuerdas: '242222', cejilla: seis(2) },
  Gm7: { cuerdas: '353333', cejilla: seis(3) },
  'G#m7': { cuerdas: '464444', cejilla: seis(4) },
  Am7: { cuerdas: 'x02010' },
  'A#m7': { cuerdas: 'x13121', cejilla: cinco(1) },
  Bm7: { cuerdas: 'x20202' },
}
