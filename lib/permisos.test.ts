import { describe, expect, test } from 'vitest'
import {
  CAPACIDADES,
  capacidadesDe,
  esRolValido,
  porQueNoEntra,
  puede,
  rutaInicial,
  type Sujeto,
} from './permisos'

// Sujetos de referencia. El rolLocal viaja EN el sujeto: ninguna pantalla lo
// resuelve por su cuenta (PRD §8.3).
const admin: Sujeto = { rol: 'admin', aprobado: true, rolLocal: null }
const director: Sujeto = { rol: 'usuario', aprobado: true, rolLocal: 'director' }
const miembro: Sujeto = { rol: 'usuario', aprobado: true, rolLocal: 'miembro' }
const sinVinculo: Sujeto = { rol: 'usuario', aprobado: true, rolLocal: null }
const pendiente: Sujeto = { rol: 'usuario', aprobado: false, rolLocal: 'director' }

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
  test('un miembro NO puede editar un canto, en ningún caso', () => {
    expect(puede(miembro, 'editar_canto')).toBe(false)
    expect(puede(miembro, 'archivar_canto')).toBe(false)
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
    expect(puede(miembro, 'ver_preferencia_ajena')).toBe(false)
  })
})

describe('lectura del repertorio', () => {
  test('un miembro aprobado puede ver el repertorio y leer un canto', () => {
    expect(puede(miembro, 'ver_repertorio')).toBe(true)
    expect(puede(miembro, 'leer_canto')).toBe(true)
  })

  test('un miembro puede guardar su propia preferencia', () => {
    expect(puede(miembro, 'guardar_preferencia_propia')).toBe(true)
    // H15 · la primera escritura del miembro en dato que el coro entero lee.
    expect(puede(miembro, 'inscribirse_a_misa')).toBe(true)
    expect(puede(miembro, 'ver_inscripciones')).toBe(true)
    // H17 · la segunda: proponer un canto. Proponer no es asignar.
    expect(puede(miembro, 'sugerir_canto')).toBe(true)
    expect(puede(miembro, 'ver_sugerencias')).toBe(true)
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

  test('el director administra los miembros de su coro; el miembro no', () => {
    expect(puede(director, 'administrar_miembros')).toBe(true)
    expect(puede(miembro, 'administrar_miembros')).toBe(false)
    // Pero no puede inscribirse a un coro del que no es parte, ni ver quién va.
    expect(puede(sinVinculo, 'inscribirse_a_misa')).toBe(false)
    expect(puede(sinVinculo, 'ver_inscripciones')).toBe(false)
    expect(puede(sinVinculo, 'sugerir_canto')).toBe(false)
    // Y proponer NO es asignar: el miembro sigue sin poder meter el canto.
    expect(puede(miembro, 'asignar_cantos_misa')).toBe(false)
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

  test('el miembro aprobado va al repertorio', () => {
    expect(rutaInicial(miembro)).toBe('/repertorio')
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
    expect(esRolValido('usuario')).toBe(true)
  })
})

describe('porQueNoEntra', () => {
  test('sin aprobar, el portón manda por encima de todo', () => {
    expect(porQueNoEntra({ aprobado: false, rolReconocido: true, tieneCoro: true })).toBe(
      'sin_aprobar'
    )
  })

  test('aprobado pero con un rol que esta versión no conoce', () => {
    // El caso real del 2026-09-03: la base migró `miembro` a `usuario` y la app
    // desplegada todavía no lo conocía. `sesion.ts` cerró hacia el NO —bien— y
    // la pantalla dijo «nadie habilitó tu cuenta», que era FALSO: estaba
    // aprobada. Un motivo propio existe para no volver a afirmar eso.
    expect(porQueNoEntra({ aprobado: true, rolReconocido: false, tieneCoro: true })).toBe(
      'rol_desconocido'
    )
  })

  test('aprobado y con rol conocido, pero sin coro todavía', () => {
    expect(porQueNoEntra({ aprobado: true, rolReconocido: true, tieneCoro: false })).toBe('sin_coro')
  })

  test('sin nada que impida entrar devuelve null', () => {
    expect(porQueNoEntra({ aprobado: true, rolReconocido: true, tieneCoro: true })).toBe(null)
  })

  test('el portón gana aunque además el rol sea desconocido', () => {
    // Los dos son ciertos, pero el que hay que decir es el que la persona puede
    // hacer algo al respecto: pedir que la aprueben.
    expect(porQueNoEntra({ aprobado: false, rolReconocido: false, tieneCoro: false })).toBe(
      'sin_aprobar'
    )
  })
})
