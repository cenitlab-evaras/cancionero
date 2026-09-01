/**
 * Semilla de Cantoral — docs/PRD.md §13
 *
 * Reglas que cumple (§13.4):
 *   1. IDEMPOTENTE: correrlo dos veces no duplica nada (clave natural).
 *   2. Declara la FUENTE de cada cifra: ver `cantos.ts`.
 *   3. ASSERTS QUE FALLAN, no que avisan: si la cuenta no cuadra, sale con error.
 *   4. Tiene su CONTRAPARTE QUE BORRA: `borrar.ts`.
 *   5. Las CONTRASEÑAS no van al repo: entran por SEED_PASSWORD.
 *
 * Usa el cliente admin, que saltea la RLS. Es el único uso justificado en el
 * producto: siembra antes de que exista nadie con permisos para hacerlo.
 *
 *   npm run db:seed
 */
import { createClient } from '@supabase/supabase-js'
import { CANTOS, CANTO_CONTROL, FUENTE, MOMENTOS, type CantoSemilla } from './cantos.ts'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SECRET = process.env.SUPABASE_SECRET_KEY
const PASSWORD = process.env.SEED_PASSWORD

if (!URL || !SECRET) {
  throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SECRET_KEY (ver .env.example).')
}
if (!PASSWORD) {
  throw new Error('Falta SEED_PASSWORD. Las contraseñas de prueba no van en el repo (PRD §13.4).')
}

const db = createClient(URL, SECRET, {
  db: { schema: 'cantoral' },
  auth: { autoRefreshToken: false, persistSession: false },
})
const auth = createClient(URL, SECRET, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const CORO_PRINCIPAL = 'Coro Misión País'
const CORO_CONTROL = 'San Ejemplo'

/** Los cinco actores del "listo cuando" de H1 (PRD §13.3). */
const USUARIOS = [
  { email: 'admin@cantoral.local', nombre: 'Admin', rol: 'admin', aprobado: true, coro: null, rolLocal: null },
  { email: 'director@cantoral.local', nombre: 'Director', rol: 'miembro', aprobado: true, coro: CORO_PRINCIPAL, rolLocal: 'director' },
  { email: 'musico@cantoral.local', nombre: 'Músico', rol: 'miembro', aprobado: true, coro: CORO_PRINCIPAL, rolLocal: 'musico' },
  { email: 'pendiente@cantoral.local', nombre: 'Pendiente', rol: 'miembro', aprobado: false, coro: null, rolLocal: null },
  { email: 'ajeno@cantoral.local', nombre: 'Ajeno', rol: 'miembro', aprobado: true, coro: CORO_CONTROL, rolLocal: 'musico' },
] as const

function afirmar(condicion: boolean, mensaje: string): asserts condicion {
  if (!condicion) {
    console.error(`\n✗ ASSERT FALLIDO: ${mensaje}`)
    process.exit(1)
  }
}

async function upsertUsuario(u: (typeof USUARIOS)[number]): Promise<string> {
  // ¿Ya existe? La semilla es idempotente por correo.
  const { data: lista, error: errLista } = await auth.auth.admin.listUsers({ perPage: 1000 })
  if (errLista) throw errLista

  let id = lista.users.find((x) => x.email === u.email)?.id

  if (!id) {
    const { data, error } = await auth.auth.admin.createUser({
      email: u.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { nombre: u.nombre },
    })
    if (error) throw error
    id = data.user.id
  }

  // El trigger `crear_perfil_al_registrarse` ya creó el perfil con
  // rol='miembro' y aprobado=false. Acá se ajusta al actor que toca.
  const { error: errPerfil } = await db
    .from('perfiles')
    .update({ nombre: u.nombre, rol: u.rol, aprobado: u.aprobado })
    .eq('id', id)
  if (errPerfil) throw errPerfil

  return id
}

async function upsertCoro(nombre: string, parroquia: string | null): Promise<string> {
  const { data: existente } = await db.from('coros').select('id').eq('nombre', nombre).maybeSingle()
  if (existente) return existente.id

  const { data, error } = await db.from('coros').insert({ nombre, parroquia }).select('id').single()
  if (error) throw error
  return data.id
}

async function upsertAutor(nombre: string): Promise<string> {
  const { data: existente } = await db.from('autores').select('id').eq('nombre', nombre).maybeSingle()
  if (existente) return existente.id

  const { data, error } = await db.from('autores').insert({ nombre }).select('id').single()
  if (error) throw error
  return data.id
}

async function upsertCanto(canto: CantoSemilla, coroId: string, momentos: Map<string, string>) {
  const autorId = canto.autor ? await upsertAutor(canto.autor) : null

  // La clave natural es (coro_id, titulo, autor_id) desde H8: el índice único
  // se alineó con RN-03 para admitir dos versiones del mismo título de autores
  // distintos. Buscar solo por título volvería a traer más de una fila y
  // `maybeSingle()` reventaría con dos «Santo» sembrados.
  const consulta = db.from('cantos').select('id').eq('coro_id', coroId).eq('titulo', canto.titulo)
  const { data: existente } = await (autorId === null
    ? consulta.is('autor_id', null)
    : consulta.eq('autor_id', autorId)
  ).maybeSingle()

  const fila = {
    coro_id: coroId,
    titulo: canto.titulo,
    autor_id: autorId,
    cifrado: canto.cifrado,
    tonalidad_original: canto.tonalidadOriginal,
    fuente_titulo: canto.fuenteNumero > 0 ? FUENTE : null,
    fuente_numero: canto.fuenteNumero > 0 ? canto.fuenteNumero : null,
    fuente_pagina: canto.fuentePagina > 0 ? canto.fuentePagina : null,
  }

  let cantoId: string
  if (existente) {
    const { error } = await db.from('cantos').update(fila).eq('id', existente.id)
    if (error) throw error
    cantoId = existente.id
  } else {
    const { data, error } = await db.from('cantos').insert(fila).select('id').single()
    if (error) throw error
    cantoId = data.id
  }

  const momentoId = momentos.get(canto.momento)
  afirmar(!!momentoId, `El momento "${canto.momento}" de "${canto.titulo}" no existe en el catálogo.`)

  // coro_id DENORMALIZADO: canto_momentos cuelga a dos saltos del raíz.
  const { error: errVinculo } = await db
    .from('canto_momentos')
    .upsert(
      { canto_id: cantoId, momento_id: momentoId, coro_id: coroId },
      { onConflict: 'canto_id,momento_id' }
    )
  if (errVinculo) throw errVinculo
}

async function main() {
  console.log('Sembrando Cantoral…')
  console.log(`Fuente: ${FUENTE}`)

  // 1 · Catálogo de momentos (global a la instalación, PRD decisión 6)
  for (const m of MOMENTOS) {
    const { data: existe } = await db
      .from('momentos_liturgicos')
      .select('id')
      .eq('codigo', m.codigo)
      .maybeSingle()
    if (!existe) {
      const { error } = await db.from('momentos_liturgicos').insert(m)
      if (error) throw error
    }
  }

  const { data: momentosFilas, error: errMomentos } = await db
    .from('momentos_liturgicos')
    .select('id, codigo')
  if (errMomentos) throw errMomentos
  const momentos = new Map(momentosFilas.map((m) => [m.codigo, m.id]))

  // 2 · Coros
  const coroPrincipal = await upsertCoro(CORO_PRINCIPAL, 'Misión País')
  const coroControl = await upsertCoro(CORO_CONTROL, null)

  // 3 · Usuarios y vínculos
  for (const u of USUARIOS) {
    const perfilId = await upsertUsuario(u)
    if (u.coro && u.rolLocal) {
      const coroId = u.coro === CORO_PRINCIPAL ? coroPrincipal : coroControl
      const { error } = await db
        .from('coro_acceso')
        .upsert(
          { perfil_id: perfilId, coro_id: coroId, rol_local: u.rolLocal },
          { onConflict: 'perfil_id,coro_id' }
        )
      if (error) throw error
    }
  }

  // 4 · Repertorio
  for (const canto of CANTOS) await upsertCanto(canto, coroPrincipal, momentos)
  await upsertCanto(CANTO_CONTROL, coroControl, momentos)

  // 5 · ASSERTS — fallan, no avisan (PRD §13.4)
  const cuenta = async (tabla: string, filtro?: { col: string; val: string }) => {
    let q = db.from(tabla).select('*', { count: 'exact', head: true })
    if (filtro) q = q.eq(filtro.col, filtro.val)
    const { count, error } = await q
    if (error) throw error
    return count ?? 0
  }

  const nMomentos = await cuenta('momentos_liturgicos')
  const nPrincipal = await cuenta('cantos', { col: 'coro_id', val: coroPrincipal })
  const nControl = await cuenta('cantos', { col: 'coro_id', val: coroControl })
  const nVinculos = await cuenta('canto_momentos')

  afirmar(nMomentos === 11, `Se esperaban 11 momentos litúrgicos y hay ${nMomentos}.`)
  afirmar(nPrincipal === CANTOS.length, `Se esperaban ${CANTOS.length} cantos en ${CORO_PRINCIPAL} y hay ${nPrincipal}.`)
  afirmar(nControl === 1, `Se esperaba 1 canto en ${CORO_CONTROL} y hay ${nControl}.`)
  afirmar(nVinculos === CANTOS.length + 1, `Todo canto debe tener su momento: ${nVinculos} vínculos para ${CANTOS.length + 1} cantos.`)

  const sinCifrado = CANTOS.filter((c) => !/\[[A-G]/.test(c.cifrado))
  afirmar(sinCifrado.length === 0, `Hay cantos sin ningún acorde: ${sinCifrado.map((c) => c.titulo).join(', ')}`)

  console.log(`✓ ${nMomentos} momentos · ${nPrincipal} cantos en ${CORO_PRINCIPAL} · ${nControl} en ${CORO_CONTROL}`)
  console.log(`✓ ${USUARIOS.length} usuarios de prueba (contraseña en SEED_PASSWORD)`)
}

main().catch((e) => {
  console.error('✗ La semilla falló:', e.message ?? e)
  process.exit(1)
})
