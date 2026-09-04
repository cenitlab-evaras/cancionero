import { describe, expect, test } from 'vitest'
import { diffLineas, resumirCambio, describirCambio, armarHistorial } from './version-cifrado'

/**
 * H19-A · Versionado del cifrado — el "listo cuando" de §17 y el §18-13.
 *
 * Lo que este motor tiene que garantizar:
 *
 *  1. **Que el director NO tenga que comparar dos bloques de texto a ojo.** El
 *     hito se justifica por poder volver atrás, pero se usa o no se usa según
 *     esto: en un teléfono de 360 px, dos cifrados de sesenta líneas uno al lado
 *     del otro no se comparan. Hay que decir QUÉ cambió.
 *  2. **Distinguir «corrigieron un acorde» de «cambiaron la letra»**, porque son
 *     dos sucesos de gravedad muy distinta y es lo primero que uno quiere saber.
 *  3. **Una línea insertada arriba no puede marcar todo el resto como cambiado.**
 *     Comparar por número de línea haría exactamente eso, y el resumen quedaría
 *     inútil justo en el caso más común de una corrección.
 */

describe('diffLineas', () => {
  test('sin cambios, todas las líneas quedan iguales', () => {
    const d = diffLineas('uno\ndos', 'uno\ndos')
    expect(d.map((l) => l.tipo)).toEqual(['igual', 'igual'])
  })

  test('una línea insertada ARRIBA no desalinea el resto', () => {
    // El caso que descarta comparar por índice de línea. Si esto fallara, el
    // resumen diría "3 líneas cambiadas" cuando cambió una.
    const d = diffLineas('uno\ndos', 'cero\nuno\ndos')
    expect(d).toEqual([
      { tipo: 'agregada', texto: 'cero' },
      { tipo: 'igual', texto: 'uno' },
      { tipo: 'igual', texto: 'dos' },
    ])
  })

  test('una línea quitada del medio', () => {
    const d = diffLineas('uno\ndos\ntres', 'uno\ntres')
    expect(d).toEqual([
      { tipo: 'igual', texto: 'uno' },
      { tipo: 'quitada', texto: 'dos' },
      { tipo: 'igual', texto: 'tres' },
    ])
  })

  test('una línea corregida sale como quitada + agregada, y el resto intacto', () => {
    const d = diffLineas('[E]Abre tu jardín\nsegunda', '[Em]Abre tu jardín\nsegunda')
    expect(d).toEqual([
      { tipo: 'quitada', texto: '[E]Abre tu jardín' },
      { tipo: 'agregada', texto: '[Em]Abre tu jardín' },
      { tipo: 'igual', texto: 'segunda' },
    ])
  })

  test('un texto vacío es UNA línea vacía, no cero líneas', () => {
    // `''.split('\n')` devuelve `['']`. No es un detalle: el diff tiene que
    // decir que la línea vacía se fue y entró otra, no inventar que no había
    // nada. En la práctica no ocurre —la columna tiene `check (length > 0)`—,
    // pero el motor es puro y se le puede pasar cualquier cosa.
    expect(diffLineas('', 'uno')).toEqual([
      { tipo: 'quitada', texto: '' },
      { tipo: 'agregada', texto: 'uno' },
    ])
  })
})

describe('resumirCambio', () => {
  test('corregir un acorde deja la letra intacta', () => {
    const r = resumirCambio('[E]Abre tu [F#m]jardín', '[Em]Abre tu [F#m]jardín')
    expect(r.letraIntacta).toBe(true)
    expect(r.acordesAntes).toBe(2)
    expect(r.acordesDespues).toBe(2)
  })

  test('cambiar una palabra marca la letra como tocada', () => {
    const r = resumirCambio('[E]Abre tu jardín', '[E]Abre tu ventana')
    expect(r.letraIntacta).toBe(false)
  })

  test('agregar un acorde se cuenta, y la letra sigue intacta', () => {
    const r = resumirCambio('[E]Abre tu jardín', '[E]Abre [A]tu jardín')
    expect(r.letraIntacta).toBe(true)
    expect(r.acordesDespues - r.acordesAntes).toBe(1)
  })

  test('cuenta las líneas que cambiaron, no las que se corrieron de lugar', () => {
    const r = resumirCambio('uno\ndos\ntres', 'cero\nuno\ndos\ntres')
    expect(r.lineasAgregadas).toBe(1)
    expect(r.lineasQuitadas).toBe(0)
  })

  test('mover un acorde de sílaba NO cuenta como cambio de letra', () => {
    // La corrección más frecuente del coro: el acorde entra una sílaba tarde.
    const r = resumirCambio('Abre [E]tu jardín', 'Abre tu [E]jardín')
    expect(r.letraIntacta).toBe(true)
    expect(r.acordesAntes).toBe(1)
    expect(r.acordesDespues).toBe(1)
  })
})

describe('describirCambio', () => {
  test('lo dice en una frase que se lee de reojo', () => {
    expect(describirCambio('[E]Abre tu jardín', '[Em]Abre tu jardín')).toBe('Acordes corregidos')
  })

  test('distingue cuando se agregaron acordes', () => {
    expect(describirCambio('[E]Abre tu jardín', '[E]Abre [A]tu jardín')).toBe('1 acorde agregado')
  })

  test('distingue cuando se quitaron', () => {
    expect(describirCambio('[E]Abre [A]tu jardín', '[E]Abre tu jardín')).toBe('1 acorde quitado')
  })

  test('cuando cambia la letra lo dice primero, porque es lo grave', () => {
    expect(describirCambio('[E]Abre tu jardín', '[E]Abre tu ventana')).toBe('Cambió la letra')
  })

  test('cambió la letra Y los acordes', () => {
    expect(describirCambio('[E]Abre tu jardín', '[Am]Abre tu ventana')).toBe(
      'Cambió la letra y los acordes'
    )
  })

  test('dos versiones idénticas —que la base no debería crear— no mienten', () => {
    expect(describirCambio('[E]uno', '[E]uno')).toBe('Sin cambios')
  })

  test('agregar una estrofa entera se dice como lo que es', () => {
    const antes = '[E]Abre tu jardín'
    const despues = '[E]Abre tu jardín\n\n[A]Segunda estrofa nueva'
    expect(describirCambio(antes, despues)).toBe('Cambió la letra y los acordes')
  })
})

describe('armarHistorial', () => {
  /**
   * LA PARTE QUE ES FÁCIL DE INVERTIR, y por eso está acá con test.
   *
   * Cada fila de `canto_version` guarda lo que HABÍA antes de un cambio. El
   * «después» de esa fila no está en ella: es el cifrado de la fila siguiente
   * en el tiempo, o el cifrado ACTUAL del canto si es la más reciente. Armar
   * eso al revés mostraría cada corrección invertida —«quitó el acorde» cuando
   * lo agregó— y nadie lo notaría hasta usarlo para decidir.
   */
  const v = (id: string, cifrado: string, cuando: string, quien: string | null = 'Ana') => ({
    id,
    cifrado,
    reemplazadoEn: cuando,
    quien,
  })

  test('el cambio más reciente va contra el cifrado ACTUAL', () => {
    const h = armarHistorial([v('b', '[E]dos', '2026-09-02')], '[Em]tres')
    expect(h).toHaveLength(1)
    expect(h[0]!.antes).toBe('[E]dos')
    expect(h[0]!.despues).toBe('[Em]tres')
  })

  test('los anteriores van contra la versión que los reemplazó, no contra la actual', () => {
    const h = armarHistorial(
      [v('b', '[E]dos', '2026-09-02'), v('a', '[D]uno', '2026-09-01')],
      '[Em]tres'
    )
    expect(h.map((c) => [c.antes, c.despues])).toEqual([
      ['[E]dos', '[Em]tres'],
      ['[D]uno', '[E]dos'],
    ])
  })

  test('trae la descripción ya resuelta, para que la pantalla no recalcule', () => {
    const h = armarHistorial([v('b', '[E]uno', '2026-09-02')], '[Em]uno')
    expect(h[0]!.descripcion).toBe('Acordes corregidos')
  })

  test('conserva quién y cuándo', () => {
    const h = armarHistorial([v('b', 'x', '2026-09-02T10:00:00Z', 'Pedro')], 'y')
    expect(h[0]!.quien).toBe('Pedro')
    expect(h[0]!.cuando).toBe('2026-09-02T10:00:00Z')
  })

  test('sin quién, no se inventa: queda nulo y la pantalla lo dice', () => {
    // Pasa de verdad: la semilla y los importadores escriben con la clave de
    // servicio, sin sesión, y el trigger guarda `auth.uid()` nulo.
    const h = armarHistorial([v('b', 'x', '2026-09-02', null)], 'y')
    expect(h[0]!.quien).toBeNull()
  })

  test('un canto que nunca se editó devuelve lista vacía', () => {
    expect(armarHistorial([], '[E]uno')).toEqual([])
  })
})
