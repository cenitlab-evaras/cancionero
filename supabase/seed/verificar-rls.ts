/**
 * Verificación de la RLS con SESIONES REALES — docs/PRD.md §15, pasos 3 y 6.
 *
 * No razona sobre el SQL: inicia sesión como cada usuario de la semilla y
 * compara qué filas le devuelve la base. Es el complemento del recorrido por la
 * app: si el no-vinculado recibe filas que no debería, la política está mal
 * aunque la pantalla se vea bien.
 *
 *   npm run verificar:rls
 */
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
const PASSWORD = process.env.SEED_PASSWORD!

if (!URL || !PUBLISHABLE || !PASSWORD) {
  throw new Error('Faltan variables de entorno (ver .env.example).')
}

type Resultado = { descripcion: string; ok: boolean; detalle: string }
const resultados: Resultado[] = []

function comprobar(descripcion: string, ok: boolean, detalle: string) {
  resultados.push({ descripcion, ok, detalle })
  console.log(`${ok ? '✓' : '✗'} ${descripcion} — ${detalle}`)
}

async function sesion(email: string) {
  const c = createClient(URL, PUBLISHABLE, {
    db: { schema: 'cantoral' },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`No se pudo entrar como ${email}: ${error.message}`)
  return c
}

async function main() {
  const musico = await sesion('musico@cantoral.local')
  const ajeno = await sesion('ajeno@cantoral.local')
  const pendiente = await sesion('pendiente@cantoral.local')
  const director = await sesion('director@cantoral.local')

  // --- Acto 1: el músico ve el repertorio de su coro -------------------------
  const { data: cantosMusico } = await musico.from('cantos').select('id, titulo')
  comprobar(
    'musico@ ve los 12 cantos de Misión País',
    cantosMusico?.length === 12,
    `${cantosMusico?.length ?? 0} cantos`
  )

  // --- Acto 2: el ajeno ve solo el suyo (lado negativo) ----------------------
  const { data: cantosAjeno } = await ajeno.from('cantos').select('id, titulo')
  comprobar(
    'ajeno@ ve 1 canto (el del coro de control)',
    cantosAjeno?.length === 1,
    `${cantosAjeno?.length ?? 0} cantos: ${cantosAjeno?.map((c) => c.titulo).join(', ') ?? '—'}`
  )

  // --- Acto 3: el ajeno NO obtiene un canto de Misión País por su id ---------
  const idAjeno = cantosMusico?.[0]?.id
  const { data: fuga } = await ajeno.from('cantos').select('id').eq('id', idAjeno!)
  comprobar(
    'ajeno@ pidiendo por id un canto de Misión País recibe CERO filas',
    (fuga?.length ?? 0) === 0,
    `${fuga?.length ?? 0} filas`
  )

  // --- Acto 4: el no aprobado no obtiene nada (el portón) --------------------
  const { data: cantosPendiente } = await pendiente.from('cantos').select('id')
  const { data: corosPendiente } = await pendiente.from('coros').select('id')
  comprobar(
    'pendiente@ (no aprobado) no obtiene ningún canto ni coro',
    (cantosPendiente?.length ?? 0) === 0 && (corosPendiente?.length ?? 0) === 0,
    `${cantosPendiente?.length ?? 0} cantos, ${corosPendiente?.length ?? 0} coros`
  )

  // --- Escritura: el músico no puede editar; el director sí -----------------
  const { error: errEscrituraMusico } = await musico
    .from('cantos')
    .update({ notas: 'intento de un músico' })
    .eq('id', idAjeno!)
    .select()
  const { data: filasMusico } = await musico.from('cantos').select('notas').eq('id', idAjeno!).single()
  comprobar(
    'musico@ no puede escribir un canto (la RLS lo frena)',
    filasMusico?.notas !== 'intento de un músico',
    errEscrituraMusico ? `error: ${errEscrituraMusico.message}` : 'cero filas afectadas, la nota no cambió'
  )

  const { data: escrituraDirector } = await director
    .from('cantos')
    .update({ notas: 'nota del director' })
    .eq('id', idAjeno!)
    .select('id')
  comprobar(
    'director@ sí puede escribir un canto de su coro',
    (escrituraDirector?.length ?? 0) === 1,
    `${escrituraDirector?.length ?? 0} filas afectadas`
  )
  // Se deja como estaba.
  await director.from('cantos').update({ notas: null }).eq('id', idAjeno!)

  // --- Catálogo global: visible para los internos aprobados -----------------
  const { data: momentosMusico } = await musico.from('momentos_liturgicos').select('id')
  comprobar(
    'musico@ ve los 11 momentos (catálogo global, clase D)',
    momentosMusico?.length === 11,
    `${momentosMusico?.length ?? 0} momentos`
  )

  // --- H3 · Las preferencias son privadas: nadie ve las de otro -------------
  // El id sale de la sesión, no de `perfiles`: la política deja ver los perfiles
  // del equipo, así que un `limit(1)` podría traer el de otra persona.
  const idMusico = (await musico.auth.getUser()).data.user!.id
  const idDirector = (await director.auth.getUser()).data.user!.id
  const { data: coroMusico } = await musico.from('coro_acceso').select('coro_id').limit(1).single()

  const { error: errPropia } = await musico.from('preferencias_lectura').upsert(
    {
      perfil_id: idMusico,
      canto_id: idAjeno!,
      coro_id: coroMusico!.coro_id,
      transposicion: 2,
      tamano_letra: 18,
    },
    { onConflict: 'perfil_id,canto_id' }
  )

  const { data: propia } = await musico
    .from('preferencias_lectura')
    .select('transposicion')
    .eq('canto_id', idAjeno!)
  comprobar(
    'musico@ ve su propia preferencia',
    propia?.[0]?.transposicion === 2,
    errPropia ? `error al guardar: ${errPropia.message}` : `transposición ${propia?.[0]?.transposicion ?? '—'}`
  )

  const { data: ajenaParaDirector } = await director
    .from('preferencias_lectura')
    .select('transposicion')
    .eq('canto_id', idAjeno!)
  comprobar(
    'director@ NO ve la preferencia del músico (ni el director ni el admin)',
    (ajenaParaDirector?.length ?? 0) === 0,
    `${ajenaParaDirector?.length ?? 0} filas`
  )

  const { error: errPrefAjena } = await musico.from('preferencias_lectura').insert({
    perfil_id: idDirector,
    canto_id: idAjeno!,
    coro_id: coroMusico!.coro_id,
    transposicion: 5,
    tamano_letra: 16,
  })
  comprobar(
    'musico@ no puede escribir la preferencia de otra persona',
    !!errPrefAjena,
    errPrefAjena ? 'la RLS rechazó el insert' : 'SE ESCRIBIÓ: la política está mal'
  )

  // Se deja como estaba.
  await musico.from('preferencias_lectura').delete().eq('canto_id', idAjeno!)

  const fallidos = resultados.filter((r) => !r.ok)
  console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones en verde`)
  if (fallidos.length > 0) process.exit(1)
}

main().catch((e) => {
  console.error('✗ La verificación falló:', e.message ?? e)
  process.exit(1)
})
