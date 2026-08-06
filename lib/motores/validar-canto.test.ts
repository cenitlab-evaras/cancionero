import { describe, expect, test } from 'vitest'
import { validarCanto } from './validar-canto'

/**
 * H8 · RN-01 de docs/FUNCIONAL.md y el "listo cuando" de §17.
 *
 * RN-01: «El título y el contenido de una canción no pueden estar vacíos. El
 * guardado se bloquea con **mensaje de error específico por campo**.» Ese "por
 * campo" es el requisito: un "revisa los datos" genérico no lo cumple.
 *
 * RN-02 (autor obligatorio) NO se hereda: el cancionero tiene muchos anónimos y
 * el "listo cuando" del hito solo exige bloquear título y cifrado.
 */

const valido = { titulo: 'Alma misionera', cifrado: '[D]Señor, toma mi vida' }

describe('validarCanto', () => {
  test('un canto con título y cifrado es válido, y devuelve lo que hay que guardar', () => {
    const r = validarCanto(valido)
    expect(r.ok).toBe(true)
    // La action guarda `limpio`, no la entrada cruda: así el recorte del título
    // se aplica una sola vez y en un lugar probado.
    expect(r.ok === true && r.limpio).toEqual({
      titulo: 'Alma misionera',
      cifrado: '[D]Señor, toma mi vida',
      tonalidadOriginal: null,
    })
  })

  test('RN-01 · sin título se bloquea, y el error dice EN QUÉ CAMPO', () => {
    const r = validarCanto({ ...valido, titulo: '' })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.errores.titulo).toBeTruthy()
    expect(r.ok === false && r.errores.cifrado).toBeUndefined()
  })

  test('RN-01 · sin cifrado se bloquea, y el error dice EN QUÉ CAMPO', () => {
    const r = validarCanto({ ...valido, cifrado: '' })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.errores.cifrado).toBeTruthy()
    expect(r.ok === false && r.errores.titulo).toBeUndefined()
  })

  test('los dos vacíos devuelven los DOS errores, no solo el primero', () => {
    // Mostrar uno por vez obliga a guardar dos veces para enterarse de todo.
    const r = validarCanto({ titulo: '', cifrado: '' })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(Object.keys(r.errores).sort()).toEqual(['cifrado', 'titulo'])
    }
  })

  test('solo espacios en blanco cuenta como vacío', () => {
    expect(validarCanto({ titulo: '   ', cifrado: valido.cifrado }).ok).toBe(false)
    expect(validarCanto({ titulo: valido.titulo, cifrado: '\n  \t ' }).ok).toBe(false)
  })

  test('el autor NO es obligatorio: el cancionero tiene anónimos', () => {
    // Divergencia declarada de RN-02. La semilla usa "Autor no declarado en la
    // fuente" para varios cantos reales.
    expect(validarCanto(valido).ok).toBe(true)
  })

  test('un cifrado sin acordes es válido: hay cantos que son solo letra', () => {
    // §14 tiene un estado para eso ("este canto no tiene acordes escritos"),
    // así que no puede ser un error de guardado.
    expect(validarCanto({ titulo: 'Solo letra', cifrado: 'Ave María' }).ok).toBe(true)
  })

  test('la tonalidad es opcional, pero si viene tiene que ser un acorde', () => {
    expect(validarCanto({ ...valido, tonalidadOriginal: 'D' }).ok).toBe(true)
    expect(validarCanto({ ...valido, tonalidadOriginal: '' }).ok).toBe(true)
    const r = validarCanto({ ...valido, tonalidadOriginal: 'no es un acorde' })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.errores.tonalidadOriginal).toBeTruthy()
  })

  test('los números de la fuente, si vienen, son positivos', () => {
    expect(validarCanto({ ...valido, fuenteNumero: 55, fuentePagina: 60 }).ok).toBe(true)
    const r = validarCanto({ ...valido, fuenteNumero: 0 })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.errores.fuenteNumero).toBeTruthy()
  })

  test('el título se recorta: " Alma " y "Alma" son el mismo canto', () => {
    // Importa porque el índice único va sobre lower(titulo): sin recortar,
    // dos espacios de diferencia crearían un duplicado que se ve idéntico.
    const r = validarCanto({ ...valido, titulo: '  Alma misionera  ' })
    expect(r.ok).toBe(true)
    expect(r.ok === true && r.limpio.titulo).toBe('Alma misionera')
  })

  test('el cifrado NO se recorta por dentro: los espacios posicionan acordes', () => {
    const cifrado = '[C]  Gracias   quiero'
    const r = validarCanto({ titulo: 'X', cifrado })
    expect(r.ok === true && r.limpio.cifrado).toBe(cifrado)
  })
})
