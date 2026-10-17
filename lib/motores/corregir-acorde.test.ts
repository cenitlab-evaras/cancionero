import { describe, expect, test } from 'vitest'
import {
  ubicarAcordes,
  aplicarCorreccion,
  normalizarAcorde,
  pasosPosibles,
  type Correccion,
} from './corregir-acorde'
import { renderizarCifrado } from './renderizar-cifrado'
import { transponer, transponerAcorde } from './transponer'

/**
 * H19-B · Corregir el acorde en el lugar — el "listo cuando" de §17.
 *
 * Lo que este motor tiene que garantizar:
 *
 *  1. **Que el acorde que se corrige es el que se tocó**, no otro con el mismo
 *     nombre. Un canto tiene veinte `[G]`; corregir «el G» no significa nada.
 *     Por eso se ubica por su ORDINAL, que no cambia al transponer ni con el
 *     ancho de la pantalla, y que tiene que coincidir con el que pinta
 *     `renderizarCifrado`.
 *  2. **Que lo único que cambia es ese acorde.** Ni la letra, ni las otras
 *     líneas, ni los demás acordes. El historial de H19-A lo va a mostrar, y
 *     un diff de una línea es lo que el director espera ver.
 *  3. **Que mover por sílaba aterriza sobre una sílaba**, y que en el borde de
 *     la línea no se pasa a la de al lado: una línea es una frase cantada.
 */

const JARDIN = [
  '{title: Abre tu jardín}',
  '[E]Abre tu jar[A]dín',
  '{comment: Coro [G]}',
  '',
  '[B]vida [E]nueva [E]',
].join('\n')

describe('ubicarAcordes', () => {
  test('numera los acordes en orden, línea por línea', () => {
    const u = ubicarAcordes(JARDIN)
    expect(u.map((a) => [a.indice, a.acorde, a.linea])).toEqual([
      [0, 'E', 1],
      [1, 'A', 1],
      [2, 'B', 4],
      [3, 'E', 4],
      [4, 'E', 4],
    ])
  })

  test('no cuenta los corchetes de un {comment:} ni de las metaetiquetas: no se pintan como acorde', () => {
    expect(ubicarAcordes(JARDIN).some((a) => a.acorde === 'G')).toBe(false)
  })

  test('la columna es la de la letra, sin los corchetes', () => {
    const [, a] = ubicarAcordes(JARDIN)
    expect(a.columna).toBe('Abre tu jar'.length)
  })

  test('el ordinal es el MISMO que pinta renderizarCifrado, con cualquier ancho', () => {
    // Si esto se desalinea, el director toca un acorde y se corrige otro.
    const u = ubicarAcordes(JARDIN)
    for (const ancho of [undefined, 12, 20, 42]) {
      const pintados = renderizarCifrado(JARDIN, { ancho }).lineas.flatMap((l) => l.acordes)
      expect(pintados.map((a) => [a.indice, a.acorde])).toEqual(u.map((a) => [a.indice, a.acorde]))
    }
  })

  test('el ordinal no cambia al transponer', () => {
    const t = ubicarAcordes(transponer(JARDIN, 2))
    expect(t.map((a) => a.acorde)).toEqual(['F#', 'B', 'C#', 'F#', 'F#'])
    expect(t.map((a) => a.indice)).toEqual([0, 1, 2, 3, 4])
  })
})

describe('normalizarAcorde', () => {
  test.each([
    ['B7', 'B7'],
    [' F#m ', 'F#m'],
    ['A9/C#', 'A9/C#'],
    ['Bb', 'Bb'],
    ['Csus4', 'Csus4'],
    ['Gmaj7', 'Gmaj7'],
  ])('acepta el acorde americano tal cual: %s', (entrada, esperado) => {
    expect(normalizarAcorde(entrada)).toBe(esperado)
  })

  test.each([
    ['RE', 'D'],
    ['MIm7', 'Em7'],
    ['FA#m', 'F#m'],
    ['sol', 'G'],
  ])('traduce la notación latina, que es como escribe el coro: %s → %s', (entrada, esperado) => {
    expect(normalizarAcorde(entrada)).toBe(esperado)
  })

  test.each([[''], ['   '], ['hola'], ['[G]'], ['G D'], ['H7']])(
    'rechaza lo que no es un acorde: %j',
    (entrada) => {
      expect(normalizarAcorde(entrada)).toBeNull()
    }
  )
})

describe('aplicarCorreccion · cambiar', () => {
  test('cambia SOLO el acorde tocado, aunque haya otros con el mismo nombre', () => {
    const r = aplicarCorreccion(JARDIN, { tipo: 'cambiar', indice: 3, acorde: 'E7', pasos: 0 })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.cifrado).toBe(JARDIN.replace('[E]nueva', '[E7]nueva'))
    expect(r.indice).toBe(3)
  })

  test('el resto del cifrado queda idéntico, byte por byte', () => {
    const r = aplicarCorreccion(JARDIN, { tipo: 'cambiar', indice: 0, acorde: 'Em', pasos: 0 })
    if (!r.ok) throw new Error(r.error)
    const antes = JARDIN.split('\n')
    const despues = r.cifrado.split('\n')
    expect(despues.filter((l, i) => l !== antes[i])).toEqual(['[Em]Abre tu jar[A]dín'])
  })

  test('devuelve la línea antes y después, para mostrarla antes de guardar', () => {
    const r = aplicarCorreccion(JARDIN, { tipo: 'cambiar', indice: 1, acorde: 'A7', pasos: 0 })
    if (!r.ok) throw new Error(r.error)
    expect(r.lineaAntes).toBe('[E]Abre tu jar[A]dín')
    expect(r.lineaDespues).toBe('[E]Abre tu jar[A7]dín')
  })

  test('un ordinal que no existe es un error, no una corrección en otro lado', () => {
    const r = aplicarCorreccion(JARDIN, { tipo: 'cambiar', indice: 9, acorde: 'E', pasos: 0 })
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/no está/i) })
  })

  test('un nombre que no es acorde se rechaza', () => {
    const r = aplicarCorreccion(JARDIN, { tipo: 'cambiar', indice: 0, acorde: 'hola', pasos: 0 })
    expect(r.ok).toBe(false)
  })

  test('sin cambios no hay nada que guardar', () => {
    const r = aplicarCorreccion(JARDIN, { tipo: 'cambiar', indice: 0, acorde: 'E', pasos: 0 })
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/no cambi/i) })
  })
})

describe('aplicarCorreccion · mover', () => {
  // [E]Abre tu jar[A]dín  →  paradas: A(0) bre(1) tu(5) jar(8) dín(11) y el final(14)
  test('una sílaba a la derecha aterriza en el inicio de la sílaba siguiente', () => {
    const r = aplicarCorreccion(JARDIN, { tipo: 'cambiar', indice: 0, acorde: 'E', pasos: 1 })
    if (!r.ok) throw new Error(r.error)
    expect(r.lineaDespues).toBe('A[E]bre tu jar[A]dín')
  })

  test('varias sílabas de una vez', () => {
    const r = aplicarCorreccion(JARDIN, { tipo: 'cambiar', indice: 0, acorde: 'E', pasos: 2 })
    if (!r.ok) throw new Error(r.error)
    expect(r.lineaDespues).toBe('Abre [E]tu jar[A]dín')
  })

  test('a la izquierda', () => {
    const r = aplicarCorreccion(JARDIN, { tipo: 'cambiar', indice: 1, acorde: 'A', pasos: -1 })
    if (!r.ok) throw new Error(r.error)
    expect(r.lineaDespues).toBe('[E]Abre tu [A]jardín')
  })

  test('mover y cambiar el nombre en la misma corrección', () => {
    const r = aplicarCorreccion(JARDIN, { tipo: 'cambiar', indice: 1, acorde: 'A7', pasos: -1 })
    if (!r.ok) throw new Error(r.error)
    expect(r.lineaDespues).toBe('[E]Abre tu [A7]jardín')
  })

  test('el final de la línea es una parada: el acorde que cae después de la última sílaba', () => {
    const r = aplicarCorreccion(JARDIN, { tipo: 'cambiar', indice: 1, acorde: 'A', pasos: 1 })
    if (!r.ok) throw new Error(r.error)
    expect(r.lineaDespues).toBe('[E]Abre tu jardín[A]')
  })

  test('no se pasa del borde de la línea', () => {
    expect(aplicarCorreccion(JARDIN, { tipo: 'cambiar', indice: 0, acorde: 'E', pasos: -1 }).ok).toBe(
      false
    )
    expect(aplicarCorreccion(JARDIN, { tipo: 'cambiar', indice: 1, acorde: 'A', pasos: 2 }).ok).toBe(
      false
    )
  })

  test('al pasar por encima de otro acorde, el ordinal nuevo se informa', () => {
    // [E]Abre tu jar[A]dín: E pasa a «dín», que ya tiene A. Conserva el orden
    // relativo con los acordes de la misma columna: queda antes de A.
    const r = aplicarCorreccion(JARDIN, { tipo: 'cambiar', indice: 0, acorde: 'E', pasos: 4 })
    if (!r.ok) throw new Error(r.error)
    expect(r.lineaDespues).toBe('Abre tu jar[E][A]dín')
    expect(r.indice).toBe(0)

    const r2 = aplicarCorreccion(JARDIN, { tipo: 'cambiar', indice: 0, acorde: 'E', pasos: 5 })
    if (!r2.ok) throw new Error(r2.error)
    expect(r2.lineaDespues).toBe('Abre tu jar[A]dín[E]')
    expect(r2.indice).toBe(1)
  })

  test('un acorde que no estaba en una parada se mueve a la parada más cercana en esa dirección', () => {
    // El importador deja acordes amontonados al inicio de una línea con sangría.
    const c = '[G]  Santo es el Señor'
    const r = aplicarCorreccion(c, { tipo: 'cambiar', indice: 0, acorde: 'G', pasos: 1 })
    if (!r.ok) throw new Error(r.error)
    expect(r.lineaDespues).toBe('  [G]Santo es el Señor')
  })

  test('en una línea de solo acordes no hay sílabas: mover no se puede', () => {
    const c = '[G] [D] [Em]'
    expect(aplicarCorreccion(c, { tipo: 'cambiar', indice: 1, acorde: 'D', pasos: 1 }).ok).toBe(false)
  })
})

describe('pasosPosibles', () => {
  test('cuántas sílabas se puede mover hacia cada lado sin salir de la línea', () => {
    // E en col 0: paradas 0,1,5,8,11,14 → izquierda 0, derecha 5
    expect(pasosPosibles(JARDIN, 0)).toEqual({ izquierda: 0, derecha: 5 })
    // A en col 11 → izquierda 4, derecha 1
    expect(pasosPosibles(JARDIN, 1)).toEqual({ izquierda: 4, derecha: 1 })
  })

  test('para uno NUEVO se cuenta desde donde nace, la sílaba siguiente a la referencia', () => {
    // Nace en col 1 («bre»): a la izquierda le queda 0 (la «A»), a la derecha 5,8,11,14.
    expect(pasosPosibles(JARDIN, 0, { nuevo: true })).toEqual({ izquierda: 1, derecha: 4 })
    // Después de A (col 11) nace al final (14): no hay nada más a la derecha.
    expect(pasosPosibles(JARDIN, 1, { nuevo: true })).toEqual({ izquierda: 5, derecha: 0 })
  })

  test('para un acorde que no existe, nada', () => {
    expect(pasosPosibles(JARDIN, 42)).toEqual({ izquierda: 0, derecha: 0 })
  })
})

describe('aplicarCorreccion · borrar', () => {
  test('quita el acorde y deja la letra intacta', () => {
    const r = aplicarCorreccion(JARDIN, { tipo: 'borrar', indice: 4 })
    if (!r.ok) throw new Error(r.error)
    expect(r.lineaDespues).toBe('[B]vida [E]nueva ')
    expect(r.indice).toBeNull()
  })

  test('el caso del importador: el repetido consecutivo', () => {
    const c = '[D]Gracias [D]quiero'
    const r = aplicarCorreccion(c, { tipo: 'borrar', indice: 1 })
    if (!r.ok) throw new Error(r.error)
    expect(r.cifrado).toBe('[D]Gracias quiero')
  })
})

describe('aplicarCorreccion · agregar', () => {
  test('el nuevo cae en la sílaba siguiente al acorde de referencia', () => {
    const r = aplicarCorreccion(JARDIN, { tipo: 'agregar', despuesDe: 0, acorde: 'B', pasos: 0 })
    if (!r.ok) throw new Error(r.error)
    expect(r.lineaDespues).toBe('[E]A[B]bre tu jar[A]dín')
    expect(r.indice).toBe(1)
  })

  test('y se puede correr con pasos antes de guardar', () => {
    const r = aplicarCorreccion(JARDIN, { tipo: 'agregar', despuesDe: 0, acorde: 'B', pasos: 2 })
    if (!r.ok) throw new Error(r.error)
    expect(r.lineaDespues).toBe('[E]Abre tu [B]jar[A]dín')
  })

  test('después de la última sílaba, el nuevo va al final de la línea', () => {
    const r = aplicarCorreccion(JARDIN, { tipo: 'agregar', despuesDe: 1, acorde: 'E', pasos: 0 })
    if (!r.ok) throw new Error(r.error)
    expect(r.lineaDespues).toBe('[E]Abre tu jar[A]dín[E]')
  })

  test('sobre la misma columna que otro, queda después del de referencia', () => {
    // A ya está al final de la línea: el nuevo no tiene parada siguiente y se
    // queda en la misma columna, detrás.
    const c = '[E]Abre tu jardín[A]'
    const r = aplicarCorreccion(c, { tipo: 'agregar', despuesDe: 1, acorde: 'B7', pasos: 0 })
    if (!r.ok) throw new Error(r.error)
    expect(r.lineaDespues).toBe('[E]Abre tu jardín[A][B7]')
    expect(r.indice).toBe(2)
  })

  test('un nombre que no es acorde se rechaza', () => {
    expect(
      aplicarCorreccion(JARDIN, { tipo: 'agregar', despuesDe: 0, acorde: '', pasos: 0 }).ok
    ).toBe(false)
  })
})

describe('la composición con la transposición (lo que hace la action)', () => {
  test('corregir sobre lo que se ve con +2 y guardar en el tono original', () => {
    // Con +2 el director ve F# donde la base guarda E. Escribe G#7 —lo que
    // oye— y se guarda G#7 bajado 2 semitonos: F#7.
    const n = 2
    const enPantalla = transponer(JARDIN, n)
    const vista = ubicarAcordes(enPantalla)[3]
    expect(vista.acorde).toBe('F#')

    const nombreGuardado = transponerAcorde(normalizarAcorde('G#7')!, -n)
    const c: Correccion = { tipo: 'cambiar', indice: 3, acorde: nombreGuardado, pasos: 0 }
    const r = aplicarCorreccion(JARDIN, c)
    if (!r.ok) throw new Error(r.error)
    expect(r.lineaDespues).toBe('[B]vida [F#7]nueva [E]')
    // Y al volver a transponer, en pantalla se ve exactamente lo que escribió.
    expect(ubicarAcordes(transponer(r.cifrado, n))[3].acorde).toBe('G#7')
  })
})
