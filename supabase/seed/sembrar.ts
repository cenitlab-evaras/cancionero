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
import { MISAS, MISA_CONTROL, type MisaSemilla } from './misas.ts'

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
  auth: { autoRefreshToken: false, persistSession: false },
})
const auth = createClient(URL, SECRET, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// El coro real del producto. Renombrado el 2026-09-02: antes decía «Coro Misión
// País», que era el nombre del cancionero de donde salió el repertorio, no el del
// coro. `upsertCoro` busca POR NOMBRE, así que cambiar esto sin renombrar antes la
// fila en la base crearía un coro nuevo y vacío, dejando huérfanos sus cantos.
const CORO_PRINCIPAL = 'Coro San José de la Familia'
const CORO_CONTROL = 'San Ejemplo'

/** Los cinco actores del "listo cuando" de H1 (PRD §13.3). */
const USUARIOS = [
  { email: 'admin@cantoral.local', nombre: 'Admin', rol: 'admin', aprobado: true, coro: null, rolLocal: null },
  { email: 'director@cantoral.local', nombre: 'Director', rol: 'usuario', aprobado: true, coro: CORO_PRINCIPAL, rolLocal: 'director' },
  { email: 'musico@cantoral.local', nombre: 'Miembro', rol: 'usuario', aprobado: true, coro: CORO_PRINCIPAL, rolLocal: 'miembro' },
  { email: 'pendiente@cantoral.local', nombre: 'Pendiente', rol: 'usuario', aprobado: false, coro: null, rolLocal: null },
  { email: 'ajeno@cantoral.local', nombre: 'Ajeno', rol: 'usuario', aprobado: true, coro: CORO_CONTROL, rolLocal: 'miembro' },
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
    // Vacío es NULL, no cadena vacía: un canto puede no declarar tonalidad
    // —el que cargó una persona por la app no la tenía— y guardarlo como ''
    // haría que la pantalla intentara transponer una tonalidad que no existe.
    tonalidad_original: canto.tonalidadOriginal || null,
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

/**
 * Una misa de ejemplo con sus cantos (H13).
 *
 * La clave natural es (coro_id, nombre, fecha): con ella, dos corridas seguidas
 * no dejan ocho misas. `fecha` es nullable, así que el "sin fecha" se busca con
 * `is` y no con `eq` — en Postgres `= null` no encuentra nada, y sin esto el
 * ensayo se duplicaría en cada siembra.
 *
 * `orden` es la posición dentro de la misa y se escribe según el orden en que
 * vienen los cantos, que en `misas.ts` ya es el litúrgico. Va desde 0 y
 * sin huecos, que es lo que H6 dejó verificado.
 */
async function upsertMisa(
  cel: MisaSemilla,
  coroId: string,
  momentos: Map<string, string>,
  perfiles: Map<string, string>
) {
  const consulta = db
    .from('misas')
    .select('id')
    .eq('coro_id', coroId)
    .eq('nombre', cel.nombre)
  const { data: existente } = await (cel.fecha === null
    ? consulta.is('fecha', null)
    : consulta.eq('fecha', cel.fecha)
  ).maybeSingle()

  let misaId: string
  if (existente) {
    misaId = existente.id
  } else {
    const { data, error } = await db
      .from('misas')
      .insert({ coro_id: coroId, nombre: cel.nombre, fecha: cel.fecha })
      .select('id')
      .single()
    if (error) throw error
    misaId = data.id
  }

  // Los cantos se reescriben enteros: son pocos y así la semilla no tiene que
  // calcular qué cambió. Igual que hace la server action de H8 con los momentos.
  await db.from('misa_cantos').delete().eq('misa_id', misaId)

  let orden = 0
  for (const entrada of cel.cantos) {
    const momentoId = momentos.get(entrada.momento)
    afirmar(!!momentoId, `El momento "${entrada.momento}" de "${cel.nombre}" no existe.`)

    const { data: canto } = await db
      .from('cantos')
      .select('id')
      .eq('coro_id', coroId)
      .eq('titulo', entrada.titulo)
      .maybeSingle()
    afirmar(!!canto, `El canto "${entrada.titulo}" de "${cel.nombre}" no está sembrado.`)

    const { error } = await db.from('misa_cantos').insert({
      misa_id: misaId,
      canto_id: canto!.id,
      momento_id: momentoId!,
      orden: orden++,
      // coro_id DENORMALIZADO: cuelga a dos saltos del raíz (§7).
      coro_id: coroId,
    })
    if (error) throw error
  }

  // H15 · quién se anotó. Se reescriben enteros por lo mismo que los cantos.
  //
  // La semilla usa la clave de servicio, así que pasa por encima de la RLS: es
  // el ÚNICO lugar donde una inscripción se escribe sin ser la propia. En la
  // app nadie inscribe a nadie — `misa_participante_write` es
  // `perfil_id = auth.uid()`, y `verificar-rls.ts` lo comprueba.
  await db.from('misa_participante').delete().eq('misa_id', misaId)

  for (const p of cel.participantes ?? []) {
    const perfilId = perfiles.get(p.email)
    afirmar(!!perfilId, `El usuario "${p.email}" de "${cel.nombre}" no está sembrado.`)

    const { error } = await db.from('misa_participante').insert({
      misa_id: misaId,
      perfil_id: perfilId!,
      // coro_id DENORMALIZADO, y la foránea compuesta exige que sea el de la
      // misa: si acá se colara otro, el insert falla en vez de mentir.
      coro_id: coroId,
      aporte: p.aporte,
      instrumento: p.instrumento ?? null,
    })
    if (error) throw error
  }
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
  // Sin parroquia: el nombre del coro ya es completo y no cuelga de otra.
  const coroPrincipal = await upsertCoro(CORO_PRINCIPAL, null)
  const coroControl = await upsertCoro(CORO_CONTROL, null)

  // 3 · Usuarios y vínculos
  const perfiles = new Map<string, string>()
  for (const u of USUARIOS) {
    const perfilId = await upsertUsuario(u)
    perfiles.set(u.email, perfilId)
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

  // 5 · Misas de ejemplo (H13). Sin historial no hay hito que verificar.
  for (const cel of MISAS) await upsertMisa(cel, coroPrincipal, momentos, perfiles)
  // La misa del coro de control, para que el aislamiento se pueda PROBAR (H15).
  await upsertMisa(MISA_CONTROL, coroControl, momentos, perfiles)

  // 6 · ASSERTS — fallan, no avisan (PRD §13.4)
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

  // DESDE H16 EL CORO TIENE MÁS CANTOS QUE LA SEMILLA: los 74 que trajo
  // `importar:cancionero` son repertorio real y no salen de acá. Afirmar el
  // TOTAL hacía fallar la semilla por el éxito del import — lo que hay que
  // comprobar es que los sembrados están, no que sean los únicos.
  const { count: sembrados, error: errSembrados } = await db
    .from('cantos')
    .select('id', { count: 'exact', head: true })
    .eq('coro_id', coroPrincipal)
    .in('titulo', CANTOS.map((c) => c.titulo))
  if (errSembrados) throw errSembrados

  afirmar(nMomentos === 11, `Se esperaban 11 momentos litúrgicos y hay ${nMomentos}.`)
  afirmar(
    sembrados === CANTOS.length,
    `Se esperaban los ${CANTOS.length} cantos de la semilla en ${CORO_PRINCIPAL} y hay ${sembrados}.`
  )
  afirmar(nControl === 1, `Se esperaba 1 canto en ${CORO_CONTROL} y hay ${nControl}.`)

  // Todo canto sembrado tiene su momento. Los importados también, pero eso lo
  // afirma su propio script.
  const { data: sinMomento, error: errSinMomento } = await db
    .from('cantos')
    .select('titulo, canto_momentos(canto_id)')
    .eq('coro_id', coroPrincipal)
    .in('titulo', CANTOS.map((c) => c.titulo))
  if (errSinMomento) throw errSinMomento
  const huerfanos = (sinMomento ?? []).filter(
    (c) => ((c.canto_momentos as unknown[]) ?? []).length === 0
  )
  afirmar(
    huerfanos.length === 0,
    `Hay cantos sembrados sin momento: ${huerfanos.map((c) => c.titulo).join(', ')}`
  )

  const sinCifrado = CANTOS.filter((c) => !/\[[A-G]/.test(c.cifrado))
  afirmar(sinCifrado.length === 0, `Hay cantos sin ningún acorde: ${sinCifrado.map((c) => c.titulo).join(', ')}`)

  // H13 · el historial tiene que quedar en pie después de sembrar dos veces.
  const nMisas = await cuenta('misas')
  const nMisaCantos = await cuenta('misa_cantos')
  const filasEsperadas = MISAS.reduce((n, c) => n + c.cantos.length, 0) + MISA_CONTROL.cantos.length
  afirmar(
    nMisas === MISAS.length + 1,
    `Se esperaban ${MISAS.length + 1} misas y hay ${nMisas}: la semilla dejó de ser idempotente.`
  )
  afirmar(
    nMisaCantos === filasEsperadas,
    `Se esperaban ${filasEsperadas} cantos en misas y hay ${nMisaCantos}.`
  )

  // H15 · las inscripciones también tienen que sobrevivir a dos corridas.
  const nInscritos = await cuenta('misa_participante')
  const inscritosEsperados = MISAS.reduce((n, c) => n + (c.participantes?.length ?? 0), 0)
  afirmar(
    nInscritos === inscritosEsperados,
    `Se esperaban ${inscritosEsperados} inscripciones y hay ${nInscritos}.`
  )

  const pasadas = MISAS.filter((c) => c.fecha !== null && c.fecha <= '2026-08-07').length
  console.log(
    `✓ ${nMomentos} momentos · ${nPrincipal} cantos en ${CORO_PRINCIPAL} (${sembrados} de la semilla) · ${nControl} en ${CORO_CONTROL}`
  )
  console.log(`✓ ${USUARIOS.length} usuarios de prueba (contraseña en SEED_PASSWORD)`)
  console.log(
    `✓ ${nMisas} misas de ejemplo · ${pasadas} ya ocurridas (las otras no cuentan como cantadas)`
  )
  console.log(`✓ ${nInscritos} inscripciones de ejemplo (H15)`)
}

main().catch((e) => {
  console.error('✗ La semilla falló:', e.message ?? e)
  process.exit(1)
})
