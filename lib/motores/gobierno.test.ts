import { describe, expect, test } from 'vitest'
import { puedeVincularse, resumenDeMiembros } from './gobierno'

/**
 * H7 · docs/PRD.md §8.4.
 *
 * El orden del alta no es decorativo: primero el admin APRUEBA el perfil,
 * después el director lo VINCULA a su coro. El "listo cuando" del hito lo dice
 * entre paréntesis —«director@ agrega a pendiente@ (ya aprobado por el
 * admin)»— y ese paréntesis es el requisito.
 */

describe('puedeVincularse', () => {
  test('un perfil aprobado se puede vincular', () => {
    expect(puedeVincularse({ aprobado: true, rol: 'miembro' })).toEqual({ ok: true })
  })

  test('un perfil SIN aprobar no se puede vincular, y dice por qué', () => {
    // Sin esto, el director vincula a alguien que igual no va a ver nada
    // (puede_ver_coro exige aprobado) y queda un miembro fantasma en la lista.
    const r = puedeVincularse({ aprobado: false, rol: 'miembro' })
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.motivo).toMatch(/aprob/i)
  })

  test('un externo no se vincula aunque esté aprobado', () => {
    // `externo` es el rol de quien no pertenece a la instalación. Aprobarlo no
    // lo convierte en miembro de un coro.
    const r = puedeVincularse({ aprobado: true, rol: 'externo' })
    expect(r.ok).toBe(false)
  })

  test('un admin aprobado se puede vincular a un coro', () => {
    // El admin no pertenece a ningún coro por defecto (§17.1), pero nada
    // impide que dirija uno: es el caso del párroco que además administra.
    expect(puedeVincularse({ aprobado: true, rol: 'admin' })).toEqual({ ok: true })
  })

  test('la regla cierra hacia el NO ante un perfil incompleto', () => {
    expect(puedeVincularse({ aprobado: false, rol: 'admin' }).ok).toBe(false)
  })
})

describe('resumenDeMiembros', () => {
  const perfiles = [
    { id: 'a', aprobado: true, rolLocal: 'director' as const },
    { id: 'b', aprobado: true, rolLocal: 'musico' as const },
    { id: 'c', aprobado: true, rolLocal: null },
    { id: 'd', aprobado: false, rolLocal: null },
  ]

  test('separa a los del coro de los que todavía no están', () => {
    const r = resumenDeMiembros(perfiles)
    expect(r.enElCoro.map((p) => p.id)).toEqual(['a', 'b'])
    expect(r.disponibles.map((p) => p.id)).toEqual(['c'])
  })

  test('los no aprobados no son "disponibles": todavía no pasaron el portón', () => {
    // Ofrecerlos para agregar sería ofrecer algo que la regla rechaza.
    expect(resumenDeMiembros(perfiles).disponibles.map((p) => p.id)).not.toContain('d')
  })

  test('cuenta los directores, para saber si el coro se queda sin uno', () => {
    expect(resumenDeMiembros(perfiles).directores).toBe(1)
  })

  test('una lista vacía no rompe', () => {
    expect(resumenDeMiembros([])).toEqual({ enElCoro: [], disponibles: [], directores: 0 })
  })
})
