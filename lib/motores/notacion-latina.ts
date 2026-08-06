/**
 * Notación latina → americana (H9 · docs/PRD.md §18-7).
 *
 * El *Cancionero Misionero* está escrito en latina (`RE`, `MIm7`, `FA#m`) y el
 * producto almacena y muestra americana (decisión 3). §18-7 dejó esto para "un
 * hito 9, si estorba"; estorbó en la primera carga real de un canto.
 *
 * Traduce lo que se ESCRIBE, no lo que se guarda: en la base sigue habiendo
 * ChordPro americano y nada más.
 *
 * **Por qué la conversión es segura de aplicar de más:** ninguna nota latina es
 * prefijo de un acorde americano válido —`DO`, `RE`, `MI`, `FA`, `SOL`, `LA` y
 * `SI` no existen como acordes en americana—, así que convertir dos veces da lo
 * mismo y un cifrado ya americano pasa intacto.
 */

/** Ordenadas por largo descendente: `SOL` tiene que probarse antes que `SI`. */
const NOTAS: [string, string][] = [
  ['SOL', 'G'],
  ['DO', 'C'],
  ['RE', 'D'],
  ['MI', 'E'],
  ['FA', 'F'],
  ['LA', 'A'],
  ['SI', 'B'],
]

/** Un acorde suelto, sin el bajo. */
function convertirCuerpo(acorde: string): string {
  const arriba = acorde.toUpperCase()

  for (const [latina, americana] of NOTAS) {
    if (!arriba.startsWith(latina)) continue

    const resto = acorde.slice(latina.length)
    // El sufijo se conserva tal cual salvo la `M` de menor, que en latina se
    // escribe pegada y en minúscula: `LAm` → `Am`. Lo demás (7, maj7, sus4,
    // 9, #, b) ya se escribe igual en las dos notaciones.
    return americana + resto
  }

  return acorde
}

export function latinaAAmericana(acorde: string): string {
  if (acorde === '') return acorde

  // El bajo de un acorde con barra también está en latina: `RE/FA#` → `D/F#`.
  return acorde.split('/').map(convertirCuerpo).join('/')
}

/**
 * ¿Este texto está escrito en notación latina?
 *
 * Se usa para ofrecer la conversión sin imponerla. El riesgo es confundir la
 * LETRA con acordes: en español «la» y «mi» son palabras comunes —«respiro la
 * aurora»—, así que no alcanza con encontrar una nota suelta.
 *
 * La prueba es más estricta: **todos** los tokens de la línea tienen que
 * parecer acordes latinos, y tiene que haber al menos uno. Una línea de letra
 * siempre trae palabras que no lo son.
 */
const ACORDE_LATINO = new RegExp(
  `^(SOL|DO|RE|MI|FA|LA|SI)(#|b)?(m|maj|sus|dim|aug|add)?[0-9]*(/(SOL|DO|RE|MI|FA|LA|SI)(#|b)?)?$`,
  'i'
)

export function esNotacionLatina(texto: string): boolean {
  const tokens = texto.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return false
  return tokens.every((t) => ACORDE_LATINO.test(t))
}
