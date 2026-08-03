import { describe, expect, test } from 'vitest'
import {
  CAPACIDADES,
  capacidadesDe,
  esRolValido,
  puede,
  rutaInicial,
  type Sujeto,
} from './permisos'

// Sujetos de referencia. El rolLocal viaja EN el sujeto: ninguna pantalla lo
// resuelve por su cuenta (PRD §8.3).
const admin: Sujeto = { rol: 'admin', aprobado: true, rolLocal: null }
const director: Sujeto = { rol: 'miembro', aprobado: true, rolLocal: 'director' }
const musico: Sujeto = { rol: 'miembro', aprobado: true, rolLocal: 'musico' }
const sinVinculo: Sujeto = { rol: 'miembro', aprobado: true, rolLocal: null }
const pendiente: Sujeto = { rol: 'miembro', aprobado: false, rolLocal: 'director' }

describe('el portón `aprobado`', () => {
  test('un sujeto no aprobado no puede NINGUNA capacidad, ni siendo director', () => {
    for (const capacidad of CAPACIDADES) {
      expect(puede(pendiente, capacidad)).toBe(false)
    }
  })

  test('un admin no aprobado tampoco puede nada', () => {
    const adminSinAprobar: Sujeto = { rol: 'admin', aprobado: false, rolLocal: null }
    expect(puede(adminSinAprobar, 'aprobar_perfil')).toBe(false)
    expect(capacidadesDe(adminSinAprobar)).toEqual([])
  })
})

describe('editar_canto — la celda que define el hito de edición', () => {
  test('un músico NO puede editar un canto, en ningún caso', () => {
    expect(puede(musico, 'editar_canto')).toBe(false)
  })

  test('un miembro sin vínculo al coro tampoco puede', () => {
    expect(puede(sinVinculo, 'editar_canto')).toBe(false)
  })

  test('un director SÍ puede — pero solo por su vínculo al coro', () => {
    expect(puede(director, 'editar_canto')).toBe(true)
  })

  test('un admin puede', () => {
    expect(puede(admin, 'editar_canto')).toBe(true)
  })
})

describe('ver_preferencia_ajena — nadie, tampoco el admin', () => {
  test('los tres roles reciben false', () => {
    expect(puede(admin, 'ver_preferencia_ajena')).toBe(false)
    expect(puede(director, 'ver_preferencia_ajena')).toBe(false)
    expect(puede(musico, 'ver_preferencia_ajena')).toBe(false)
  })
})

describe('lectura del repertorio', () => {
  test('un músico aprobado puede ver el repertorio y leer un canto', () => {
    expect(puede(musico, 'ver_repertorio')).toBe(true)
    expect(puede(musico, 'leer_canto')).toBe(true)
  })

  test('un músico puede guardar su propia preferencia', () => {
    expect(puede(musico, 'guardar_preferencia_propia')).toBe(true)
  })

  test('un externo aprobado no ve el repertorio', () => {
    const externo: Sujeto = { rol: 'externo', aprobado: true, rolLocal: null }
    expect(puede(externo, 'ver_repertorio')).toBe(false)
  })
})

describe('gobierno', () => {
  test('solo el admin crea coros y aprueba perfiles', () => {
    expect(puede(admin, 'crear_coro')).toBe(true)
    expect(puede(admin, 'aprobar_perfil')).toBe(true)
    expect(puede(director, 'crear_coro')).toBe(false)
    expect(puede(director, 'aprobar_perfil')).toBe(false)
  })

  test('el director administra los miembros de su coro; el músico no', () => {
    expect(puede(director, 'administrar_miembros')).toBe(true)
    expect(puede(musico, 'administrar_miembros')).toBe(false)
  })

  test('solo el admin edita los catálogos globales', () => {
    expect(puede(admin, 'editar_catalogo')).toBe(true)
    expect(puede(director, 'editar_catalogo')).toBe(false)
  })
})

describe('rutaInicial — una sola fuente de enrutamiento', () => {
  test('el no aprobado va al portón', () => {
    expect(rutaInicial(pendiente)).toBe('/esperando-aprobacion')
  })

  test('el músico aprobado va al repertorio', () => {
    expect(rutaInicial(musico)).toBe('/repertorio')
  })

  test('un externo aprobado no tiene a dónde ir todavía', () => {
    const externo: Sujeto = { rol: 'externo', aprobado: true, rolLocal: null }
    expect(rutaInicial(externo)).toBe('/esperando-aprobacion')
  })
})

describe('esRolValido', () => {
  test('un rol desconocido nunca se trata como válido', () => {
    expect(esRolValido('director')).toBe(false) // director es rol_local, no rol global
    expect(esRolValido('admin')).toBe(true)
    expect(esRolValido('miembro')).toBe(true)
  })
})
