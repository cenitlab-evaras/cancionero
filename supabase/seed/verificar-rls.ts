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
import { createHash, randomBytes } from 'node:crypto'

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
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await c.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) throw new Error(`No se pudo entrar como ${email}: ${error.message}`)
  return c
}

// El link lleva un token de 32 bytes en claro; la base guarda solo su SHA-256.
// El verificador arma el hash igual que la server action: así prueba la RPC con
// el mismo valor que va a recibir en producción.
function tokenNuevo() {
  return randomBytes(32).toString('hex')
}

function hashDeToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

async function main() {
  const musico = await sesion('musico@cantoral.local')
  const ajeno = await sesion('ajeno@cantoral.local')
  const pendiente = await sesion('pendiente@cantoral.local')
  const director = await sesion('director@cantoral.local')

  // --- Acto 1: el miembro ve el repertorio de su coro -------------------------
  const { data: cantosMusico } = await musico.from('cantos').select('id, titulo')
  const { data: cantosDirector } = await director.from('cantos').select('id')
  // Contra lo que ve el DIRECTOR del mismo coro, no contra un número fijo:
  // desde H8 el repertorio crece por la app y un literal se rompe solo.
  comprobar(
    'musico@ ve el mismo repertorio que el director de su coro',
    (cantosMusico?.length ?? 0) === (cantosDirector?.length ?? -1) &&
      (cantosMusico?.length ?? 0) >= 12,
    `${cantosMusico?.length ?? 0} cantos, el director ve ${cantosDirector?.length ?? 0}`
  )

  // --- Acto 2: el ajeno ve solo el suyo (lado negativo) ----------------------
  const { data: cantosAjeno } = await ajeno.from('cantos').select('id, titulo')
  comprobar(
    'ajeno@ ve 1 canto (el del coro de control)',
    cantosAjeno?.length === 1,
    `${cantosAjeno?.length ?? 0} cantos: ${cantosAjeno?.map((c) => c.titulo).join(', ') ?? '—'}`
  )

  // --- Acto 3: el ajeno NO obtiene un canto de San José por su id ---------
  const idAjeno = cantosMusico?.[0]?.id
  const { data: fuga } = await ajeno.from('cantos').select('id').eq('id', idAjeno!)
  comprobar(
    'ajeno@ pidiendo por id un canto de San José recibe CERO filas',
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

  // --- Escritura: el miembro no puede editar; el director sí -----------------
  const { error: errEscrituraMusico } = await musico
    .from('cantos')
    .update({ notas: 'intento de un miembro' })
    .eq('id', idAjeno!)
    .select()
  const { data: filasMusico } = await musico.from('cantos').select('notas').eq('id', idAjeno!).single()
  comprobar(
    'musico@ no puede escribir un canto (la RLS lo frena)',
    filasMusico?.notas !== 'intento de un miembro',
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
  // El catálogo pasó de 11 a 12 el 2026-11-18 (`20261118000000_momento_salida.sql`
  // agregó «Salida»). El número se actualiza, no se borra la comprobación: lo
  // que protege es que el miembro vea el catálogo global completo.
  const { data: momentosMusico } = await musico.from('momentos_liturgicos').select('id')
  comprobar(
    'musico@ ve los 12 momentos (catálogo global, clase D)',
    momentosMusico?.length === 12,
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
    'director@ NO ve la preferencia del miembro (ni el director ni el admin)',
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

  // --- H6 · Misas ----------------------------------------------------
  // Solo corren si hay una misa armada; la semilla no crea ninguna.
  const { data: misa } = await director
    .from('misas')
    .select('id, coro_id, nombre')
    .limit(1)
    .maybeSingle()

  if (!misa) {
    console.log('\n· sin misas armadas: se omiten las comprobaciones de H6')
  } else {
    const { data: veMusico } = await musico.from('misas').select('id').eq('id', misa.id)
    comprobar(
      'musico@ ve la misa de su coro',
      (veMusico?.length ?? 0) === 1,
      `${veMusico?.length ?? 0} filas`
    )

    const { data: veAjeno } = await ajeno.from('misas').select('id').eq('id', misa.id)
    comprobar(
      'ajeno@ pidiendo la misa por id recibe CERO filas',
      (veAjeno?.length ?? 0) === 0,
      `${veAjeno?.length ?? 0} filas`
    )

    const { data: vePendiente } = await pendiente.from('misas').select('id')
    comprobar(
      'pendiente@ (no aprobado) no obtiene ninguna misa',
      (vePendiente?.length ?? 0) === 0,
      `${vePendiente?.length ?? 0} filas`
    )

    const { error: errCrear } = await musico
      .from('misas')
      .insert({ coro_id: misa.coro_id, nombre: 'intento de un miembro' })
    comprobar(
      'musico@ no puede crear una misa (la RLS lo frena)',
      !!errCrear,
      errCrear ? 'la RLS rechazó el insert' : 'SE ESCRIBIÓ: la política está mal'
    )

    const { data: unMomento } = await musico.from('momentos_liturgicos').select('id').limit(1).single()
    const { error: errAgregar } = await musico.from('misa_cantos').insert({
      misa_id: misa.id,
      canto_id: idAjeno!,
      momento_id: unMomento!.id,
      orden: 999,
      coro_id: misa.coro_id,
    })
    comprobar(
      'musico@ no puede agregar un canto a la misa',
      !!errAgregar,
      errAgregar ? 'la RLS rechazó el insert' : 'SE ESCRIBIÓ: la política está mal'
    )

    const { data: antes } = await musico
      .from('misa_cantos')
      .select('id, orden')
      .eq('misa_id', misa.id)
      .order('orden')
    await musico.from('misa_cantos').delete().eq('id', antes![0]!.id)
    const { data: despues } = await musico
      .from('misa_cantos')
      .select('id')
      .eq('misa_id', misa.id)
    comprobar(
      'musico@ no puede quitar un canto de la misa',
      (despues?.length ?? 0) === (antes?.length ?? 0),
      `${antes?.length ?? 0} antes, ${despues?.length ?? 0} después`
    )

    const { data: escrituraDirector } = await director
      .from('misas')
      .update({ nombre: misa.nombre })
      .eq('id', misa.id)
      .select('id')
    comprobar(
      'director@ sí puede editar la misa de su coro',
      (escrituraDirector?.length ?? 0) === 1,
      `${escrituraDirector?.length ?? 0} filas afectadas`
    )

    // El "listo cuando" de H6: el orden que se ve es el que se guardó.
    const ordenes = (antes ?? []).map((f: { orden: number }) => f.orden)
    comprobar(
      'el orden guardado es consecutivo desde 0, sin huecos ni repetidos',
      JSON.stringify(ordenes) === JSON.stringify(ordenes.map((_, i) => i)),
      JSON.stringify(ordenes)
    )
  }

  // --- Lecturas de la misa · misa_lectura, RLS y RPC (2026-11-20) ------------
  // La tabla nueva y la RPC de guardado. La RPC es `security invoker`: el
  // delete y el insert pasan por la RLS de `misa_lectura`, y `es_director_de`
  // devuelve un error claro en vez de cero filas afectadas. Las tres sesiones
  // prueban lo mismo que la matriz de las misas: el director guarda, el coro
  // lee, el ajeno ni ve ni escribe.
  if (!misa) {
    console.log('· sin misas armadas: se omiten las comprobaciones de lecturas')
  } else {
    const parte = {
      tipo: 'primera',
      referencia: 'Isaías 55, 1-11',
      texto: 'Esto dice el Señor: vengan a mí.',
      fuente: 'manual',
    }

    // El director guarda las cuatro partes con una sola llamada; acá va una
    // sola para que el conteo sea exacto y fácil de leer.
    const { error: errGuardarDirector } = await director.rpc('guardar_lecturas', {
      p_misa_id: misa.id,
      p_partes: [parte],
    })
    const { data: lecturasDirector } = await director
      .from('misa_lectura')
      .select('id, tipo, referencia, texto')
      .eq('misa_id', misa.id)
    comprobar(
      'director@ guarda las lecturas de su misa por la RPC',
      !errGuardarDirector && lecturasDirector?.length === 1,
      errGuardarDirector
        ? `error: ${errGuardarDirector.message}`
        : `${lecturasDirector?.length ?? 0} filas`
    )

    const { data: lecturasMusico } = await musico
      .from('misa_lectura')
      .select('id, tipo, texto')
      .eq('misa_id', misa.id)
    comprobar(
      'musico@ ve la lectura de su coro',
      lecturasMusico?.[0]?.texto === parte.texto,
      `${lecturasMusico?.length ?? 0} filas · ${lecturasMusico?.[0]?.tipo ?? '—'}`
    )

    // La RPC también se prueba por acción directa: los predicados de la tabla
    // podrían dejar pasar un delete vacío silencioso; lo que tiene que pasar es
    // un error.
    const { error: errGuardarMusico } = await musico.rpc('guardar_lecturas', {
      p_misa_id: misa.id,
      p_partes: [{ tipo: 'salmo', texto: 'intento de un miembro' }],
    })
    const { data: lecturasTrasMusico } = await director
      .from('misa_lectura')
      .select('tipo')
      .eq('misa_id', misa.id)
    comprobar(
      'musico@ no puede guardar lecturas: la RPC le responde «No tienes permiso»',
      errGuardarMusico?.message === 'No tienes permiso' &&
        (lecturasTrasMusico ?? []).every((l) => l.tipo !== 'salmo'),
      errGuardarMusico ? `la RPC falló: ${errGuardarMusico.message}` : 'LA RPC NO FALLÓ: falta el permiso'
    )

    const { data: lecturasAjeno } = await ajeno.from('misa_lectura').select('id')
    comprobar(
      'ajeno@ no ve ninguna lectura de San José',
      (lecturasAjeno?.length ?? 0) === 0,
      `${lecturasAjeno?.length ?? 0} filas`
    )

    // Para el ajeno la misa ni siquiera existe: la RLS filtra el `select` de la
    // RPC y esta corta con «La misa no existe». Falla igual, que es lo que
    // importa.
    const { error: errGuardarAjeno } = await ajeno.rpc('guardar_lecturas', {
      p_misa_id: misa.id,
      p_partes: [{ tipo: 'primera', texto: 'intento de un ajeno' }],
    })
    comprobar(
      'ajeno@ no puede guardar lecturas: su RPC falla',
      !!errGuardarAjeno,
      errGuardarAjeno ? `la RPC falló: ${errGuardarAjeno.message}` : 'LA RPC NO FALLÓ: la política está mal'
    )

    // La nota de una sugerencia: solo con misa y hasta 280 caracteres. El check
    // es la última línea, no el formulario — la prueba va por acción directa.
    // Se busca un par canto/momento que este perfil no haya usado, para que un
    // rechazo inesperado no pueda confundirse con el índice único.
    const { data: usadas } = await musico
      .from('sugerencia')
      .select('canto_id, momento_id')
      .eq('perfil_id', idMusico)
    const par = (cantosMusico ?? [])
      .flatMap((c) =>
        (momentosMusico ?? []).map((m) => ({ canto_id: c.id as string, momento_id: m.id as string }))
      )
      .find((p) => !(usadas ?? []).some((u) => u.canto_id === p.canto_id && u.momento_id === p.momento_id))

    if (!par) {
      comprobar(
        'una sugerencia con misa y nota se acepta',
        false,
        'NO SE PUDO PROBAR: no quedó un par canto/momento libre para el miembro'
      )
    } else {
      const baseNota = {
        perfil_id: idMusico,
        canto_id: par.canto_id,
        momento_id: par.momento_id,
        coro_id: misa.coro_id,
      }

      const { error: errNotaGeneral } = await musico
        .from('sugerencia')
        .insert({ ...baseNota, misa_id: null, nota: 'Un porqué sin misa' })
      comprobar(
        'una sugerencia general con nota la rechaza el check de la base',
        errNotaGeneral?.code === '23514',
        errNotaGeneral ? 'el check lo rechazó' : 'SE ESCRIBIÓ: falta el check'
      )

      const { data: conNota, error: errNotaMisa } = await musico
        .from('sugerencia')
        .insert({ ...baseNota, misa_id: misa.id, nota: 'Porque habla del perdón.' })
        .select('nota')
        .maybeSingle()
      comprobar(
        'una sugerencia con misa y nota de hasta 280 caracteres se acepta',
        conNota?.nota === 'Porque habla del perdón.',
        errNotaMisa ? `RECHAZADA: ${errNotaMisa.message}` : 'nota guardada'
      )

      // Se deja el coro como estaba: sin la sugerencia de prueba. El par se
      // eligió libre, así que cualquier fila que quede con estas claves es de
      // acá — también la general si el check hubiera fallado en rechazarla.
      await musico
        .from('sugerencia')
        .delete()
        .eq('perfil_id', idMusico)
        .eq('canto_id', par.canto_id)
        .eq('momento_id', par.momento_id)
    }

    // Y la misa, sin lecturas: la semilla no siembra ninguna.
    await director.from('misa_lectura').delete().eq('misa_id', misa.id)
  }

  // --- H7 · Gobernar el coro -------------------------------------------------
  const admin = await sesion('admin@cantoral.local')

  const { data: coroMusico2 } = await musico.from('coro_acceso').select('coro_id').limit(1).single()
  const coroId = coroMusico2!.coro_id
  const idPendiente = (
    await admin.from('perfiles').select('id').eq('email', 'pendiente@cantoral.local').single()
  ).data!.id

  // El miembro no gobierna: ni admite gente ni cambia roles.
  const { error: errAdmitir } = await musico
    .from('coro_acceso')
    .insert({ perfil_id: idPendiente, coro_id: coroId, rol_local: 'miembro' })
  comprobar(
    'musico@ no puede admitir a nadie al coro (la RLS lo frena)',
    !!errAdmitir,
    errAdmitir ? 'la RLS rechazó el insert' : 'SE ESCRIBIÓ: la política está mal'
  )

  const { error: errAprobar } = await musico
    .from('perfiles')
    .update({ aprobado: true })
    .eq('id', idPendiente)
  const { data: sigueSinAprobar } = await admin
    .from('perfiles')
    .select('aprobado')
    .eq('id', idPendiente)
    .single()
  comprobar(
    'musico@ no puede aprobar un perfil',
    sigueSinAprobar?.aprobado === false,
    errAprobar ? `error: ${errAprobar.message}` : 'cero filas afectadas, sigue sin aprobar'
  )

  const { error: errCoro } = await musico.from('coros').insert({ nombre: 'Coro del miembro' })
  comprobar(
    'musico@ no puede crear un coro',
    !!errCoro,
    errCoro ? 'la RLS rechazó el insert' : 'SE ESCRIBIÓ: la política está mal'
  )

  // LA PUERTA VIEJA ESTÁ CERRADA: desde las invitaciones ya no existe política
  // de INSERT en `coro_acceso`. El director no vincula perfiles existentes, ni
  // antes ni después de aprobarlos; el único alta es la RPC de la invitación.
  const { error: errVinculoDirecto } = await director
    .from('coro_acceso')
    .insert({ perfil_id: idPendiente, coro_id: coroId, rol_local: 'miembro' })
  comprobar(
    'director@ NO puede vincular a nadie directo en coro_acceso (el alta es por invitación)',
    !!errVinculoDirecto,
    errVinculoDirecto ? 'la RLS rechazó el insert' : 'SE VINCULÓ: falta cerrar el insert'
  )

  // La aprobación manual sigue existiendo como legado (§10 del diseño).
  await admin.from('perfiles').update({ aprobado: true }).eq('id', idPendiente)
  const { data: yaAprobado } = await admin
    .from('perfiles')
    .select('aprobado')
    .eq('id', idPendiente)
    .single()
  comprobar('admin@ sí puede aprobar un perfil', yaAprobado?.aprobado === true, 'aprobado')

  // Se vuelve a cerrar el portón a propósito: lo que sigue comprueba que quien
  // lo abre ahora es `aceptar_invitacion`, no un update del admin.
  await admin.from('perfiles').update({ aprobado: false }).eq('id', idPendiente)

  // --- Invitaciones (2026-11-25) ---------------------------------------------
  // El flujo completo en la base: quién crea cada invitación, que el invitado
  // no lea la tabla, que la vista pública no filtre correos ajenos y que la
  // aceptación sea la única puerta que escribe `coro_acceso`.
  const idAdmin = (await admin.auth.getUser()).data.user!.id
  const expira = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const emailInvitado = 'pendiente@cantoral.local'
  const tokenDirector = tokenNuevo()
  const hashDirector = hashDeToken(tokenDirector)

  // Si una corrida anterior se cortó antes de limpiar, se borran las pendientes
  // de prueba para no chocar con el índice único de invitación pendiente.
  await admin
    .from('invitacion')
    .delete()
    .in('email', [emailInvitado, 'invitado-miembro@cantoral.local', 'director@cantoral.local'])

  // 1 · El admin invita a un director.
  const { data: invitacionDirector, error: errInvitaDirector } = await admin
    .from('invitacion')
    .insert({
      email: emailInvitado,
      coro_id: coroId,
      rol_local: 'director',
      token_hash: hashDirector,
      creada_por: idAdmin,
      expira_en: expira,
    })
    .select('id')
    .single()
  comprobar(
    'admin@ invita a un director',
    !!invitacionDirector && !errInvitaDirector,
    errInvitaDirector?.message ?? '1 invitación'
  )

  // 2 · Un director NO invita a otro director: eso es del admin.
  const { error: errDirectorInvitaDirector } = await director.from('invitacion').insert({
    email: 'otro-director@cantoral.local',
    coro_id: coroId,
    rol_local: 'director',
    token_hash: hashDeToken(tokenNuevo()),
    creada_por: idDirector,
    expira_en: expira,
  })
  comprobar(
    'director@ NO puede invitar a un director',
    !!errDirectorInvitaDirector,
    errDirectorInvitaDirector ? 'la RLS rechazó el insert' : 'SE INVITÓ: la política está mal'
  )

  // 3 · Un director invita a un miembro en SU coro, y no en otro.
  const { data: invitacionMiembro, error: errInvitaMiembro } = await director
    .from('invitacion')
    .insert({
      email: 'invitado-miembro@cantoral.local',
      coro_id: coroId,
      rol_local: 'miembro',
      token_hash: hashDeToken(tokenNuevo()),
      creada_por: idDirector,
      expira_en: expira,
    })
    .select('id')
    .single()
  comprobar(
    'director@ invita a un miembro en su coro',
    !!invitacionMiembro && !errInvitaMiembro,
    errInvitaMiembro?.message ?? '1 invitación'
  )

  const { data: coroAjeno } = await ajeno.from('coro_acceso').select('coro_id').limit(1).single()
  const { error: errInvitaOtroCoro } = await director.from('invitacion').insert({
    email: 'invitado-otro@cantoral.local',
    coro_id: coroAjeno!.coro_id,
    rol_local: 'miembro',
    token_hash: hashDeToken(tokenNuevo()),
    creada_por: idDirector,
    expira_en: expira,
  })
  comprobar(
    'director@ NO invita a un miembro en otro coro',
    !!errInvitaOtroCoro,
    errInvitaOtroCoro ? 'la RLS rechazó el insert' : 'SE INVITÓ: la política está mal'
  )

  // 4 · Un miembro no invita a nadie.
  const { error: errInvitaMusico } = await musico.from('invitacion').insert({
    email: 'otro-miembro@cantoral.local',
    coro_id: coroId,
    rol_local: 'miembro',
    token_hash: hashDeToken(tokenNuevo()),
    creada_por: idMusico,
    expira_en: expira,
  })
  comprobar(
    'musico@ no puede invitar a nadie',
    !!errInvitaMusico,
    errInvitaMusico ? 'la RLS rechazó el insert' : 'SE INVITÓ: la política está mal'
  )

  // 5 · El invitado no lee la tabla: la invitación se consulta por RPC.
  const { data: invitacionesPendiente } = await pendiente.from('invitacion').select('id')
  comprobar(
    'pendiente@ (el invitado) NO lee la tabla de invitaciones',
    (invitacionesPendiente?.length ?? 0) === 0,
    `${invitacionesPendiente?.length ?? 0} filas`
  )

  // 6 · La vista pública: con el email correcto muestra el coro; con otro, nada.
  const { data: publicaPropia } = await pendiente.rpc('invitacion_publica', { p_hash: hashDirector })
  const { data: nombreCoro } = await admin.from('coros').select('nombre').eq('id', coroId).single()
  comprobar(
    'invitacion_publica(hash) le muestra el coro al email correcto',
    publicaPropia?.[0]?.coro_nombre === nombreCoro?.nombre &&
      publicaPropia?.[0]?.rol_local === 'director',
    publicaPropia?.[0]
      ? `${publicaPropia[0].coro_nombre} · ${publicaPropia[0].rol_local}`
      : '0 filas'
  )

  const { data: publicaAjena } = await ajeno.rpc('invitacion_publica', { p_hash: hashDirector })
  comprobar(
    'invitacion_publica(hash) con otro email devuelve CERO filas',
    (publicaAjena?.length ?? 0) === 0,
    `${publicaAjena?.length ?? 0} filas`
  )

  // Aceptar con el email equivocado tampoco abre la puerta.
  const { error: errAceptaAjena } = await ajeno.rpc('aceptar_invitacion', { p_hash: hashDirector })
  comprobar(
    'ajeno@ no puede aceptar una invitación que no es de su email',
    !!errAceptaAjena,
    errAceptaAjena?.message ?? 'SE ACEPTÓ: la función no mira el email'
  )

  // 7 · Aceptar: crea el vínculo, marca la invitación y abre el portón.
  const { data: coroAceptado, error: errAceptar } = await pendiente.rpc('aceptar_invitacion', {
    p_hash: hashDirector,
  })
  const { data: invitacionAceptada } = await admin
    .from('invitacion')
    .select('aceptada_en')
    .eq('id', invitacionDirector?.id ?? '')
    .single()
  const { data: accesoAceptado } = await admin
    .from('coro_acceso')
    .select('rol_local')
    .eq('perfil_id', idPendiente)
    .eq('coro_id', coroId)
    .maybeSingle()
  const { data: perfilAceptado } = await admin
    .from('perfiles')
    .select('aprobado')
    .eq('id', idPendiente)
    .single()

  comprobar(
    'aceptar_invitacion(hash) devuelve el coro y crea el coro_acceso como director',
    !errAceptar && coroAceptado === coroId && accesoAceptado?.rol_local === 'director',
    errAceptar?.message ??
      `coro ${coroAceptado === coroId ? 'correcto' : 'distinto'} · rol ${accesoAceptado?.rol_local ?? '—'}`
  )
  comprobar(
    'aceptar_invitacion marca aceptada_en y aprueba el perfil',
    !!invitacionAceptada?.aceptada_en && perfilAceptado?.aprobado === true,
    `aceptada_en ${invitacionAceptada?.aceptada_en ? 'sí' : 'NO'} · aprobado ${perfilAceptado?.aprobado ?? '—'}`
  )

  // El mismo token no se usa dos veces.
  const { error: errRepetida } = await pendiente.rpc('aceptar_invitacion', { p_hash: hashDirector })
  comprobar(
    'el mismo token no se puede aceptar dos veces',
    !!errRepetida,
    errRepetida?.message ?? 'SE ACEPTÓ DE NUEVO: falta el control de uso único'
  )

  // El recién llegado ve el repertorio en su siguiente entrada.
  const recienLlegado = await sesion('pendiente@cantoral.local')
  const { data: veRepertorio } = await recienLlegado.from('cantos').select('id')
  const { data: veDirector } = await director.from('cantos').select('id')
  comprobar(
    'el recién admitido ve el mismo repertorio que el director',
    (veRepertorio?.length ?? 0) === (veDirector?.length ?? -1),
    `${veRepertorio?.length ?? 0} cantos`
  )

  // El upsert de la aceptación NO degrada a un director: si ya dirigía el coro
  // y acepta una invitación de miembro, conserva el rol. Se invita a sí mismo
  // —es el único director sembrado— y se comprueba que sigue dirigiendo.
  const tokenNoDegrada = tokenNuevo()
  const { data: invitacionNoDegrada, error: errInvitacionNoDegrada } = await director
    .from('invitacion')
    .insert({
      email: 'director@cantoral.local',
      coro_id: coroId,
      rol_local: 'miembro',
      token_hash: hashDeToken(tokenNoDegrada),
      creada_por: idDirector,
      expira_en: expira,
    })
    .select('id')
    .single()

  if (!invitacionNoDegrada) {
    comprobar(
      'aceptar una invitación de miembro NO degrada a un director',
      false,
      `NO SE PUDO PROBAR: ${errInvitacionNoDegrada?.message ?? 'no se creó la invitación'}`
    )
  } else {
    const { error: errAceptaNoDegrada } = await director.rpc('aceptar_invitacion', {
      p_hash: hashDeToken(tokenNoDegrada),
    })
    const { data: sigueDirector } = await admin
      .from('coro_acceso')
      .select('rol_local')
      .eq('perfil_id', idDirector)
      .eq('coro_id', coroId)
      .single()
    comprobar(
      'aceptar una invitación de miembro NO degrada a un director',
      !errAceptaNoDegrada && sigueDirector?.rol_local === 'director',
      errAceptaNoDegrada?.message ?? `rol ${sigueDirector?.rol_local ?? '—'}`
    )
    await admin.from('invitacion').delete().eq('id', invitacionNoDegrada.id)
  }

  // 8 · Las filas de director: solo el admin las toca. El `using` del update y
  // del delete mira la fila ACTUAL, así que un director no puede degradar ni
  // borrar a otro director; el `with check` le impide lo simétrico, convertir
  // un miembro en director.
  const { data: degradadoPorDirector } = await director
    .from('coro_acceso')
    .update({ rol_local: 'miembro' })
    .eq('perfil_id', idPendiente)
    .eq('coro_id', coroId)
    .select('rol_local')
  comprobar(
    'director@ NO puede degradar una fila de director',
    (degradadoPorDirector?.length ?? 0) === 0,
    `${degradadoPorDirector?.length ?? 0} filas afectadas`
  )

  await director
    .from('coro_acceso')
    .delete()
    .eq('perfil_id', idPendiente)
    .eq('coro_id', coroId)
  const { data: directorSigue } = await admin
    .from('coro_acceso')
    .select('rol_local')
    .eq('perfil_id', idPendiente)
    .eq('coro_id', coroId)
    .single()
  comprobar(
    'director@ NO puede borrar una fila de director',
    directorSigue?.rol_local === 'director',
    directorSigue?.rol_local === 'director' ? 'la fila sigue ahí' : 'SE BORRÓ: la política está mal'
  )

  const { data: ascendidoPorDirector, error: errAscensoDirector } = await director
    .from('coro_acceso')
    .update({ rol_local: 'director' })
    .eq('perfil_id', idMusico)
    .eq('coro_id', coroId)
    .select('rol_local')
  const { data: rolMusicoTrasIntento } = await admin
    .from('coro_acceso')
    .select('rol_local')
    .eq('perfil_id', idMusico)
    .eq('coro_id', coroId)
    .single()
  comprobar(
    'director@ NO puede convertir a un miembro en director (el with check lo frena)',
    (ascendidoPorDirector?.length ?? 0) === 0 && rolMusicoTrasIntento?.rol_local === 'miembro',
    errAscensoDirector?.message ?? `${ascendidoPorDirector?.length ?? 0} filas afectadas`
  )

  const { data: adminTocaDirector } = await admin
    .from('coro_acceso')
    .update({ rol_local: 'miembro' })
    .eq('perfil_id', idPendiente)
    .eq('coro_id', coroId)
    .select('rol_local')
  const { data: adminRestaura } = await admin
    .from('coro_acceso')
    .update({ rol_local: 'director' })
    .eq('perfil_id', idPendiente)
    .eq('coro_id', coroId)
    .select('rol_local')
  comprobar(
    'admin@ sí puede actualizar una fila de director',
    adminTocaDirector?.[0]?.rol_local === 'miembro' && adminRestaura?.[0]?.rol_local === 'director',
    `miembro → ${adminRestaura?.[0]?.rol_local ?? '—'}`
  )

  // Se deja como estaba: sin vínculo, sin invitaciones y el portón cerrado.
  const { data: borrada } = await admin
    .from('coro_acceso')
    .delete()
    .eq('perfil_id', idPendiente)
    .eq('coro_id', coroId)
    .select('id')
  comprobar(
    'admin@ sí puede borrar una fila de director',
    (borrada?.length ?? 0) === 1,
    `${borrada?.length ?? 0} filas borradas`
  )

  const idsInvitaciones = [invitacionDirector?.id, invitacionMiembro?.id].filter(Boolean)
  if (idsInvitaciones.length > 0) {
    await admin.from('invitacion').delete().in('id', idsInvitaciones)
  }
  await admin.from('perfiles').update({ aprobado: false }).eq('id', idPendiente)

  // --- H8 · Editar el repertorio ---------------------------------------------
  const { data: coroDelMusico } = await musico.from('coro_acceso').select('coro_id').limit(1).single()

  const { error: errCrearCanto } = await musico.from('cantos').insert({
    coro_id: coroDelMusico!.coro_id,
    titulo: 'Canto del miembro',
    cifrado: '[C]No debería existir',
  })
  comprobar(
    'musico@ no puede crear un canto por acción directa',
    !!errCrearCanto,
    errCrearCanto ? 'la RLS rechazó el insert' : 'SE ESCRIBIÓ: la política está mal'
  )

  // El director puede dar de alta un autor (H8), pero no renombrar el catálogo.
  const nombreNuevo = `Autor de prueba ${resultados.length}`
  const { data: autorNuevo, error: errAutor } = await director
    .from('autores')
    .insert({ nombre: nombreNuevo })
    .select('id')
  comprobar(
    'director@ sí puede dar de alta un autor (H8)',
    (autorNuevo?.length ?? 0) === 1,
    errAutor ? `error: ${errAutor.message}` : '1 fila'
  )

  const { data: renombrado } = await director
    .from('autores')
    .update({ nombre: 'Renombrado por el director' })
    .eq('id', autorNuevo![0].id)
    .select('id')
  comprobar(
    'director@ NO puede renombrar un autor: el catálogo es de la instalación',
    (renombrado?.length ?? 0) === 0,
    `${renombrado?.length ?? 0} filas afectadas`
  )

  const { error: errAutorMusico } = await musico.from('autores').insert({ nombre: 'Autor del miembro' })
  comprobar(
    'musico@ no puede dar de alta un autor',
    !!errAutorMusico,
    errAutorMusico ? 'la RLS rechazó el insert' : 'SE ESCRIBIÓ: la política está mal'
  )

  // Se deja como estaba.
  await admin.from('autores').delete().eq('id', autorNuevo![0].id)

  // --- H10 · Estado del canto -------------------------------------------------
  // El estado es del CANTO, no de quien lo mira: lo mueve el director y lo ve
  // todo el coro. No hay política nueva —cae dentro de `cantos_write`— así que
  // lo que hay que comprobar es justamente eso: que la política vieja alcanza.
  const { data: estadoAntes } = await director
    .from('cantos')
    .select('estado')
    .eq('id', idAjeno!)
    .single()

  const { error: errEstadoMusico } = await musico
    .from('cantos')
    .update({ estado: 'en_ensayo' })
    .eq('id', idAjeno!)
  const { data: trasIntento } = await musico.from('cantos').select('estado').eq('id', idAjeno!).single()
  comprobar(
    'musico@ no puede cambiar el estado de un canto (la RLS lo frena)',
    trasIntento?.estado === estadoAntes?.estado,
    errEstadoMusico
      ? `error: ${errEstadoMusico.message}`
      : `cero filas afectadas, sigue en «${trasIntento?.estado}»`
  )

  const { data: estadoDirector } = await director
    .from('cantos')
    .update({ estado: 'en_ensayo' })
    .eq('id', idAjeno!)
    .select('estado')
  comprobar(
    'director@ sí puede poner un canto de su coro en ensayo',
    estadoDirector?.[0]?.estado === 'en_ensayo',
    `${estadoDirector?.length ?? 0} filas afectadas`
  )

  // El `check` de la migración es la última línea: ni el director escribe un
  // estado que no existe.
  //
  // ESTA COMPROBACIÓN CAMBIÓ DE VALOR EL 2026-09-03. H10 la escribió con
  // `archivado`, que entonces estaba fuera del dominio a propósito. Al cerrar
  // §16 ese estado pasó a ser legítimo y la comprobación empezó a fallar — hizo
  // exactamente lo que tenía que hacer: avisar de que el dominio se movió. Se
  // cambia el valor por uno que sigue sin existir, no se borra la comprobación.
  const { error: errEstadoInvalido } = await director
    .from('cantos')
    .update({ estado: 'suspendido' })
    .eq('id', idAjeno!)
  comprobar(
    'ni el director puede escribir un estado inexistente: el check lo rechaza',
    !!errEstadoInvalido,
    errEstadoInvalido ? 'la base rechazó «archivado»' : 'SE ESCRIBIÓ: falta el check'
  )

  // Se deja como estaba.
  await director.from('cantos').update({ estado: estadoAntes?.estado ?? 'listo' }).eq('id', idAjeno!)

  // --- H11 · La preferencia de perfil es privada ------------------------------
  // Tabla nueva, política nueva: hay que comprobarla, no suponer que se hereda
  // de `preferencias_lectura` porque "se le parece".
  const { error: errPrefPerfilPropia } = await musico
    .from('preferencias_perfil')
    .upsert({ perfil_id: idMusico, mostrar_acordes: false }, { onConflict: 'perfil_id' })
  const { data: prefPropia } = await musico.from('preferencias_perfil').select('mostrar_acordes')
  comprobar(
    'musico@ guarda y ve su propia preferencia de perfil (H11)',
    prefPropia?.[0]?.mostrar_acordes === false,
    errPrefPerfilPropia ? `error: ${errPrefPerfilPropia.message}` : 'mostrar_acordes = false'
  )

  const { data: prefAjenaDirector } = await director
    .from('preferencias_perfil')
    .select('perfil_id')
    .eq('perfil_id', idMusico)
  comprobar(
    'director@ NO ve la preferencia de perfil del miembro',
    (prefAjenaDirector?.length ?? 0) === 0,
    `${prefAjenaDirector?.length ?? 0} filas`
  )

  const { data: prefAjenaAdmin } = await admin
    .from('preferencias_perfil')
    .select('perfil_id')
    .eq('perfil_id', idMusico)
  comprobar(
    'admin@ tampoco la ve: no hay excepción para el administrador',
    (prefAjenaAdmin?.length ?? 0) === 0,
    `${prefAjenaAdmin?.length ?? 0} filas`
  )

  const { error: errEscribirAjena } = await musico
    .from('preferencias_perfil')
    .upsert({ perfil_id: idDirector, mostrar_acordes: false }, { onConflict: 'perfil_id' })
  comprobar(
    'musico@ no puede apagarle los acordes a otra persona',
    !!errEscribirAjena,
    errEscribirAjena ? 'la RLS rechazó el upsert' : 'SE ESCRIBIÓ: la política está mal'
  )

  // Se deja como estaba: sin fila, que es el estado por defecto (acordes a la
  // vista) y el que la app trata como "todavía nadie eligió".
  await musico.from('preferencias_perfil').delete().eq('perfil_id', idMusico)

  // ---------------------------------------------------------------------------
  // H14 · Ficha del miembro — el "listo cuando" de §17, lado seguridad.
  //
  // Lo que hay que probar acá y no en un test unitario: que la ficha sea
  // escribible por su dueño SIN abrir la puerta a escribirse el rol, y que el
  // director la lea sin que la lean los demás.
  // ---------------------------------------------------------------------------

  const { data: coroParaPerfil } = await musico
    .from('coro_acceso')
    .select('coro_id')
    .limit(1)
    .single()
  const coroSanJose = coroParaPerfil!.coro_id

  const { error: errFichaPropia } = await musico.from('ficha_miembro').upsert(
    {
      perfil_id: idMusico,
      coro_id: coroSanJose,
      tesitura: 'tenor',
      disponibilidad: 'casi_siempre',
      fecha_nacimiento: '1995-04-10',
    },
    { onConflict: 'perfil_id,coro_id' }
  )
  comprobar(
    'musico@ carga su propia ficha (H14)',
    !errFichaPropia,
    errFichaPropia ? `RECHAZADA: ${errFichaPropia.message}` : 'guardada'
  )

  const { data: fichaVistaPorDirector } = await director
    .from('ficha_miembro')
    .select('tesitura, disponibilidad, fecha_nacimiento')
    .eq('perfil_id', idMusico)
    .eq('coro_id', coroSanJose)
  comprobar(
    'director@ ve la ficha de su miembro',
    fichaVistaPorDirector?.[0]?.tesitura === 'tenor',
    `${fichaVistaPorDirector?.length ?? 0} filas · tesitura ${fichaVistaPorDirector?.[0]?.tesitura ?? '—'}`
  )

  const { data: fichaAjenaMusico } = await musico
    .from('ficha_miembro')
    .select('perfil_id')
    .eq('perfil_id', idDirector)
  comprobar(
    'musico@ NO ve la ficha de otra persona',
    (fichaAjenaMusico?.length ?? 0) === 0,
    `${fichaAjenaMusico?.length ?? 0} filas`
  )

  const { data: fichaVistaPorAjeno } = await ajeno
    .from('ficha_miembro')
    .select('perfil_id')
    .eq('coro_id', coroSanJose)
  comprobar(
    'ajeno@ no ve ninguna ficha de San José',
    (fichaVistaPorAjeno?.length ?? 0) === 0,
    `${fichaVistaPorAjeno?.length ?? 0} filas`
  )

  const { error: errFichaAjena } = await musico.from('ficha_miembro').upsert(
    { perfil_id: idDirector, coro_id: coroSanJose, tesitura: 'bajo' },
    { onConflict: 'perfil_id,coro_id' }
  )
  comprobar(
    'musico@ no puede escribir la ficha de otro',
    !!errFichaAjena,
    errFichaAjena ? 'la RLS rechazó el upsert' : 'SE ESCRIBIÓ: la política está mal'
  )

  // El punto del hito: la ficha vive en otra tabla PARA QUE escribirla no sea
  // una puerta a `rol_local`. Que siga cerrada es lo que hay que comprobar.
  const { data: ascenso } = await musico
    .from('coro_acceso')
    .update({ rol_local: 'director' })
    .eq('perfil_id', idMusico)
    .eq('coro_id', coroSanJose)
    .select('rol_local')
  comprobar(
    'musico@ sigue sin poder ascenderse a director (la ficha no abrió esa puerta)',
    (ascenso?.length ?? 0) === 0,
    (ascenso?.length ?? 0) === 0 ? 'cero filas afectadas' : 'SE ASCENDIÓ: la política está mal'
  )

  // Se deja el coro como estaba.
  await musico.from('ficha_miembro').delete().eq('perfil_id', idMusico).eq('coro_id', coroSanJose)

  // --- Acto 8: archivar un canto es del director (§16, cerrado el 2026-09-03) --
  {
    const { data: unCanto } = await director
      .from('cantos')
      .select('id, estado')
      .eq('coro_id', coroSanJose)
      .neq('estado', 'archivado')
      .limit(1)
      .single()

    const { data: archivado } = await director
      .from('cantos')
      .update({ estado: 'archivado' })
      .eq('id', unCanto!.id)
      .select('estado')
      .maybeSingle()
    comprobar(
      'director@ archiva un canto de su coro',
      archivado?.estado === 'archivado',
      archivado?.estado ?? 'no se pudo'
    )

    // El canto archivado NO desaparece de la base: sigue ahí para el historial
    // y para las misas donde se cantó. Eso es lo que separa archivar de borrar.
    const { data: sigueVivo } = await musico.from('cantos').select('id').eq('id', unCanto!.id)
    comprobar(
      'un canto archivado sigue existiendo para el coro (no es un borrado)',
      (sigueVivo?.length ?? 0) === 1,
      (sigueVivo?.length ?? 0) === 1 ? 'la fila está' : 'DESAPARECIÓ: se borró de verdad'
    )

    // Se restaura ANTES de probar al miembro: si no, el canto ya está archivado
    // por el director y la comprobación pasaría por eso, no por la RLS.
    await director.from('cantos').update({ estado: unCanto!.estado }).eq('id', unCanto!.id)

    await musico.from('cantos').update({ estado: 'archivado' }).eq('id', unCanto!.id)
    const { data: trasIntentoArchivo } = await musico
      .from('cantos')
      .select('estado')
      .eq('id', unCanto!.id)
      .single()
    comprobar(
      'musico@ no puede archivar un canto',
      trasIntentoArchivo?.estado !== 'archivado',
      trasIntentoArchivo?.estado !== 'archivado'
        ? `sigue en «${trasIntentoArchivo?.estado}»`
        : 'SE ARCHIVÓ: la política está mal'
    )

    // Un estado inventado lo frena el `check`, no la RLS: el director puede
    // escribir la columna, pero no cualquier cosa en ella.
    const { error: errBasura } = await director
      .from('cantos')
      .update({ estado: 'borrado' })
      .eq('id', unCanto!.id)
    comprobar(
      'ni el director puede inventar un estado',
      !!errBasura,
      errBasura ? 'el check de la columna lo rechazó' : 'SE ESCRIBIÓ: falta el check'
    )

    // Se deja el repertorio como estaba.
    await director.from('cantos').update({ estado: unCanto!.estado }).eq('id', unCanto!.id)
  }

  // --- Acto 9: H15 · la primera escritura del miembro en dato compartido ------
  {
    const { data: misaPropia } = await director
      .from('misas')
      .select('id')
      .eq('coro_id', coroSanJose)
      .limit(1)
      .single()

    // Se guarda lo que había para poder dejarlo igual: la semilla siembra
    // inscripciones y sus asserts cuentan, así que el verificador no puede
    // llevarse una fila por el camino.
    const { data: previa } = await musico
      .from('misa_participante')
      .select('aporte, instrumento')
      .eq('misa_id', misaPropia!.id)
      .eq('perfil_id', idMusico)
      .maybeSingle()

    const { data: inscrito } = await musico
      .from('misa_participante')
      .upsert(
        {
          misa_id: misaPropia!.id,
          perfil_id: idMusico,
          coro_id: coroSanJose,
          aporte: 'instrumental',
          instrumento: 'guitarra',
        },
        { onConflict: 'misa_id,perfil_id' }
      )
      .select('aporte')
      .maybeSingle()
    comprobar(
      'musico@ se inscribe a una misa de su coro (§19.5: escribe su propia fila)',
      inscrito?.aporte === 'instrumental',
      inscrito?.aporte ?? 'no se pudo'
    )

    // LA NOVEDAD FRENTE A H11 Y H14: acá el miembro SÍ ve lo ajeno, porque para
    // eso existe el dato — que el coro se vea a sí mismo.
    const { data: veAlDirector } = await musico
      .from('misa_participante')
      .select('perfil_id')
      .eq('misa_id', misaPropia!.id)
    comprobar(
      'musico@ ve las inscripciones de sus compañeros (a diferencia de la ficha)',
      (veAlDirector?.length ?? 0) >= 1,
      `${veAlDirector?.length ?? 0} filas visibles`
    )

    const { error: errAjena } = await musico.from('misa_participante').insert({
      misa_id: misaPropia!.id,
      perfil_id: idDirector,
      coro_id: coroSanJose,
      aporte: 'vocal',
      instrumento: null,
    })
    comprobar(
      'musico@ no puede inscribir a otra persona',
      !!errAjena,
      errAjena ? 'la RLS rechazó el insert' : 'SE ESCRIBIÓ: la política está mal'
    )

    // Ni el DIRECTOR inscribe a nadie: la inscripción es una declaración de la
    // persona sobre sí misma, y eso no es una excepción del rol.
    const { error: errDirectorInscribe } = await director.from('misa_participante').insert({
      misa_id: misaPropia!.id,
      perfil_id: idMusico,
      coro_id: coroSanJose,
      aporte: 'vocal',
      instrumento: null,
    })
    comprobar(
      'director@ tampoco puede inscribir a otro',
      !!errDirectorInscribe,
      errDirectorInscribe ? 'la RLS rechazó el insert' : 'SE ESCRIBIÓ: nadie declara por nadie'
    )

    // EL AGUJERO QUE CIERRA LA FORÁNEA COMPUESTA: coro_id propio (que sí puede
    // ver) con la misa de OTRO coro. Los dos predicados de la política pasan;
    // lo único que lo frena es la integridad referencial.
    const { data: misaAjena } = await ajeno.from('misas').select('id').limit(1).maybeSingle()
    if (!misaAjena) {
      // NO se salta en silencio. Es la comprobación más importante del hito: si
      // no hay con qué correrla, el verificador tiene que decirlo y ponerse en
      // rojo, no dar 52/52 habiendo probado 51.
      comprobar(
        'musico@ no puede inscribirse a una misa de otro coro con su propio coro_id',
        false,
        'NO SE PUDO PROBAR: el coro de control no tiene ninguna misa sembrada'
      )
    } else {
      const { error: errCruzada } = await musico.from('misa_participante').insert({
        misa_id: misaAjena.id,
        perfil_id: idMusico,
        coro_id: coroSanJose,
        aporte: 'vocal',
        instrumento: null,
      })
      comprobar(
        'musico@ no puede inscribirse a una misa de otro coro con su propio coro_id',
        !!errCruzada,
        errCruzada ? 'la foránea compuesta lo rechazó' : 'SE ESCRIBIÓ: falta la foránea compuesta'
      )
    }

    // El `check` condicional de B2, del lado de la base.
    const { error: errSinInstrumento } = await musico.from('misa_participante').upsert(
      {
        misa_id: misaPropia!.id,
        perfil_id: idMusico,
        coro_id: coroSanJose,
        aporte: 'instrumental',
        instrumento: null,
      },
      { onConflict: 'misa_id,perfil_id' }
    )
    comprobar(
      'tocar sin decir qué se toca lo rechaza la base, no solo el formulario',
      !!errSinInstrumento,
      errSinInstrumento ? 'el check condicional lo rechazó' : 'SE ESCRIBIÓ: falta el check'
    )

    const { data: veAjeno } = await ajeno
      .from('misa_participante')
      .select('perfil_id')
      .eq('misa_id', misaPropia!.id)
    comprobar(
      'ajeno@ no ve ninguna inscripción de este coro',
      (veAjeno?.length ?? 0) === 0,
      `${veAjeno?.length ?? 0} filas`
    )

    // Se deja la misa exactamente como estaba.
    if (previa) {
      await musico.from('misa_participante').upsert(
        {
          misa_id: misaPropia!.id,
          perfil_id: idMusico,
          coro_id: coroSanJose,
          aporte: previa.aporte,
          instrumento: previa.instrumento,
        },
        { onConflict: 'misa_id,perfil_id' }
      )
    } else {
      await musico
        .from('misa_participante')
        .delete()
        .eq('misa_id', misaPropia!.id)
        .eq('perfil_id', idMusico)
    }
  }

  // --- Acto 10: H17 · la segunda escritura del miembro en dato compartido -----
  {
    const { data: unCanto } = await musico
      .from('cantos')
      .select('id')
      .eq('coro_id', coroSanJose)
      .limit(1)
      .single()
    const { data: unMomento2 } = await musico
      .from('momentos_liturgicos')
      .select('id')
      .limit(1)
      .single()
    const { data: miMisa } = await director
      .from('misas')
      .select('id')
      .eq('coro_id', coroSanJose)
      .limit(1)
      .single()

    const base = {
      perfil_id: idMusico,
      canto_id: unCanto!.id,
      momento_id: unMomento2!.id,
      coro_id: coroSanJose,
    }

    await musico
      .from('sugerencia')
      .delete()
      .eq('perfil_id', idMusico)
      .eq('canto_id', unCanto!.id)
      .eq('momento_id', unMomento2!.id)

    const { data: propuesta } = await musico
      .from('sugerencia')
      .insert({ ...base, misa_id: null })
      .select('canto_id')
      .maybeSingle()
    comprobar(
      'musico@ propone un canto de su coro (§19.5, segunda escritura)',
      !!propuesta,
      propuesta ? 'la propuesta entró' : 'no se pudo'
    )

    // La misma propuesta dos veces no infla el ranking: lo frena el índice
    // único PARCIAL, que existe porque en Postgres dos NULL no son iguales y un
    // único normal habría dejado pasar infinitas propuestas generales.
    const { error: errDoble } = await musico
      .from('sugerencia')
      .insert({ ...base, misa_id: null })
    comprobar(
      'la misma propuesta general no se puede repetir (índice parcial sobre misa_id nulo)',
      !!errDoble,
      errDoble ? 'la base la rechazó' : 'SE DUPLICÓ: el índice parcial falta'
    )

    // Pero la general y la de misa SON distintas: pedir algo en general no es
    // pedirlo para el domingo. Es la consecuencia de haber pedido las dos cosas.
    const { data: paraLaMisa } = await musico
      .from('sugerencia')
      .insert({ ...base, misa_id: miMisa!.id })
      .select('misa_id')
      .maybeSingle()
    comprobar(
      'la propuesta para una misa convive con la general: son dos preguntas',
      !!paraLaMisa,
      paraLaMisa ? 'las dos filas coexisten' : 'se rechazó: el índice parcial está de más'
    )

    const { data: veDirector } = await director
      .from('sugerencia')
      .select('canto_id')
      .eq('perfil_id', idMusico)
    comprobar(
      'el coro ve las propuestas de sus compañeros, con quién las hizo',
      (veDirector?.length ?? 0) >= 1,
      `${veDirector?.length ?? 0} filas visibles`
    )

    const { error: errAjena2 } = await musico.from('sugerencia').insert({
      ...base,
      perfil_id: idDirector,
      misa_id: null,
    })
    comprobar(
      'musico@ no puede proponer en nombre de otro',
      !!errAjena2,
      errAjena2 ? 'la RLS rechazó el insert' : 'SE ESCRIBIÓ: la política está mal'
    )

    // PROPONER NO ES ASIGNAR: el límite de §19.5, comprobado en la base y no
    // solo en la pantalla.
    const { error: errAsignar } = await musico.from('misa_cantos').insert({
      misa_id: miMisa!.id,
      canto_id: unCanto!.id,
      momento_id: unMomento2!.id,
      orden: 99,
      coro_id: coroSanJose,
    })
    comprobar(
      'proponer no le abrió la puerta a asignar: el canto lo mete el director',
      !!errAsignar,
      errAsignar ? 'la RLS le rechaza misa_cantos' : 'SE ASIGNÓ: H17 abrió una puerta'
    )

    // El agujero entre coros, otra vez: canto ajeno con el coro propio.
    const { data: cantoAjeno } = await ajeno.from('cantos').select('id').limit(1).maybeSingle()
    if (!cantoAjeno) {
      comprobar(
        'musico@ no puede proponer un canto de otro coro',
        false,
        'NO SE PUDO PROBAR: el coro de control no tiene cantos'
      )
    } else {
      const { error: errCruzada2 } = await musico.from('sugerencia').insert({
        ...base,
        canto_id: cantoAjeno.id,
        misa_id: null,
      })
      comprobar(
        'musico@ no puede proponer un canto de otro coro con su propio coro_id',
        !!errCruzada2,
        errCruzada2 ? 'la foránea compuesta lo rechazó' : 'SE ESCRIBIÓ: falta la foránea compuesta'
      )
    }

    const { data: veAjeno2 } = await ajeno.from('sugerencia').select('canto_id')
    comprobar(
      'ajeno@ no ve ninguna propuesta de este coro',
      (veAjeno2?.length ?? 0) === 0,
      `${veAjeno2?.length ?? 0} filas`
    )

    const { error: errRetirarAjena } = await director
      .from('sugerencia')
      .delete()
      .eq('perfil_id', idMusico)
      .eq('canto_id', unCanto!.id)
    const { data: sigue } = await musico
      .from('sugerencia')
      .select('canto_id')
      .eq('perfil_id', idMusico)
      .eq('canto_id', unCanto!.id)
    comprobar(
      'ni el director puede retirar la propuesta de otro',
      (sigue?.length ?? 0) > 0,
      errRetirarAjena || (sigue?.length ?? 0) > 0
        ? 'las propuestas siguen ahí'
        : 'SE BORRARON: la política está mal'
    )

    // Se deja el coro como estaba: la semilla vuelve a poner las suyas.
    await musico
      .from('sugerencia')
      .delete()
      .eq('perfil_id', idMusico)
      .eq('canto_id', unCanto!.id)
      .eq('momento_id', unMomento2!.id)
  }

  // --- Acto 15: el historial del cifrado (H19-A) ----------------------------
  //
  // ES UNA CLASE DE TABLA NUEVA en este producto: la leen todos y NO LA ESCRIBE
  // NADIE. Las cuatro comprobaciones de abajo son la única prueba de que eso es
  // cierto — la matriz de `permisos.ts` no tiene siquiera una capacidad para
  // escribir acá, así que si la política estuviera floja nada en el código lo
  // delataría.
  {
    const { data: versionesMusico } = await musico
      .from('canto_version')
      .select('id, canto_id, cifrado')
    comprobar(
      'musico@ VE el historial de cambios de su coro',
      (versionesMusico?.length ?? 0) > 0,
      `${versionesMusico?.length ?? 0} versiones — el miembro tiene que poder ver que un acorde cambió`
    )

    const { data: versionesAjeno } = await ajeno.from('canto_version').select('id')
    comprobar(
      'ajeno@ no ve ninguna versión de San José',
      (versionesAjeno?.length ?? 0) === 0,
      `${versionesAjeno?.length ?? 0} filas`
    )

    const unaVersion = versionesMusico?.[0]
    if (!unaVersion) {
      comprobar(
        'el historial es de solo lectura para todos',
        false,
        'NO SE PUDO PROBAR: no hay ninguna versión sembrada'
      )
    } else {
      // El miembro no escribe.
      const { error: errInsertMiembro } = await musico.from('canto_version').insert({
        canto_id: unaVersion.canto_id,
        coro_id: (await musico.from('cantos').select('coro_id').eq('id', unaVersion.canto_id).maybeSingle()).data?.coro_id,
        cifrado: 'inventado por el miembro',
      })
      comprobar(
        'musico@ no puede fabricar una versión',
        !!errInsertMiembro,
        errInsertMiembro ? 'la RLS lo rechazó' : 'SE ESCRIBIÓ: la tabla tiene política de escritura'
      )

      // Y EL DIRECTOR TAMPOCO. Esta es la comprobación que da sentido al hito:
      // un historial que la parte interesada puede editar o borrar no es un
      // historial, es una sugerencia.
      const { error: errInsertDirector } = await director.from('canto_version').insert({
        canto_id: unaVersion.canto_id,
        coro_id: (await director.from('cantos').select('coro_id').eq('id', unaVersion.canto_id).maybeSingle()).data?.coro_id,
        cifrado: 'inventado por el director',
      })
      comprobar(
        'NI EL DIRECTOR puede fabricar una versión',
        !!errInsertDirector,
        errInsertDirector ? 'la RLS lo rechazó' : 'SE ESCRIBIÓ: el historial no es confiable'
      )

      const { error: errBorrar } = await director
        .from('canto_version')
        .delete()
        .eq('id', unaVersion.id)
      const { data: sigueAhi } = await director
        .from('canto_version')
        .select('id')
        .eq('id', unaVersion.id)
      comprobar(
        'ni el director puede borrar una versión',
        (sigueAhi?.length ?? 0) === 1,
        errBorrar || (sigueAhi?.length ?? 0) === 1
          ? 'la versión sigue ahí'
          : 'SE BORRÓ: el historial se puede reescribir'
      )

      const { error: errEditar } = await director
        .from('canto_version')
        .update({ cifrado: 'reescrito' })
        .eq('id', unaVersion.id)
      const { data: intacta } = await director
        .from('canto_version')
        .select('cifrado')
        .eq('id', unaVersion.id)
        .maybeSingle()
      comprobar(
        'ni el director puede reescribir una versión',
        intacta?.cifrado === unaVersion.cifrado,
        errEditar || intacta?.cifrado === unaVersion.cifrado
          ? 'el texto guardado no cambió'
          : 'SE REESCRIBIÓ: el historial no prueba nada'
      )

      // EL TRIGGER, que es la otra mitad del hito: el rastro no depende de que
      // la aplicación se acuerde de escribirlo.
      const { data: cantoPrueba } = await director
        .from('cantos')
        .select('id, cifrado')
        .eq('id', unaVersion.canto_id)
        .maybeSingle()
      if (cantoPrueba) {
        const original = cantoPrueba.cifrado
        // Los ids que YA estaban. Es como se limpia después: se borran los que
        // aparecieron, no los que no coinciden con una lista de fechas copiada
        // de la semilla — dos verdades que algún día se separan.
        const { data: previas } = await director
          .from('canto_version')
          .select('id')
          .eq('canto_id', cantoPrueba.id)
        const idsPrevios = new Set((previas ?? []).map((v) => v.id))
        const antes = (
          await director.from('canto_version').select('id', { count: 'exact', head: true }).eq('canto_id', cantoPrueba.id)
        ).count ?? 0

        await director
          .from('cantos')
          .update({ cifrado: `${original}\n[G]Línea de prueba de H19-A` })
          .eq('id', cantoPrueba.id)

        const { data: nueva } = await director
          .from('canto_version')
          .select('cifrado, reemplazado_por')
          .eq('canto_id', cantoPrueba.id)
          .order('reemplazado_en', { ascending: false })
          .limit(1)
          .maybeSingle()
        const despues = (
          await director.from('canto_version').select('id', { count: 'exact', head: true }).eq('canto_id', cantoPrueba.id)
        ).count ?? 0

        comprobar(
          'editar el cifrado deja una versión SOLA, con el texto anterior y quién lo cambió',
          despues === antes + 1 && nueva?.cifrado === original && !!nueva?.reemplazado_por,
          `${antes} → ${despues} versiones · texto anterior ${nueva?.cifrado === original ? 'guardado' : 'PERDIDO'} · autor ${nueva?.reemplazado_por ? 'registrado' : 'NULO'}`
        )

        // Y que un update que NO toca el cifrado no ensucie el historial.
        const antesRuido = despues
        await director
          .from('cantos')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', cantoPrueba.id)
        const ruido = (
          await director.from('canto_version').select('id', { count: 'exact', head: true }).eq('canto_id', cantoPrueba.id)
        ).count ?? 0
        comprobar(
          'guardar sin tocar el cifrado NO crea una versión',
          ruido === antesRuido,
          `${antesRuido} → ${ruido} versiones`
        )

        // Se deja el canto como estaba. Devolverlo deja SU PROPIA fila —es el
        // comportamiento del hito, no un descuido— así que hay que barrer las
        // dos: la de la prueba y la de la vuelta atrás.
        await director.from('cantos').update({ cifrado: original }).eq('id', cantoPrueba.id)

        // La clave de servicio es la única que puede borrar acá, y eso mismo es
        // lo que las comprobaciones de arriba acaban de demostrar. Si falta, se
        // dice: dejar basura en silencio haría fallar la semilla mañana por un
        // motivo que nadie ataría a esto.
        const SECRETA = process.env.SUPABASE_SECRET_KEY
        if (!SECRETA) {
          console.log(
            '  ! sin SUPABASE_SECRET_KEY: quedan 2 versiones de prueba en el historial de ese canto'
          )
        } else {
          const servicio = createClient(URL, SECRETA, {
            auth: { autoRefreshToken: false, persistSession: false },
          })
          const { data: ahora } = await servicio
            .from('canto_version')
            .select('id')
            .eq('canto_id', cantoPrueba.id)
          const nuevas = (ahora ?? []).map((v) => v.id).filter((id) => !idsPrevios.has(id))
          if (nuevas.length > 0) {
            await servicio.from('canto_version').delete().in('id', nuevas)
          }
        }
      }

      // El miembro no restaura: restaurar es escribir `cantos`, y eso sigue
      // siendo del director desde H1.
      const { data: cantoMusico } = await musico.from('cantos').select('id, cifrado').limit(1).maybeSingle()
      const { data: pisado } = await musico
        .from('cantos')
        .update({ cifrado: '[C]pisado por el miembro' })
        .eq('id', cantoMusico!.id)
        .select('id')
      comprobar(
        'musico@ no puede restaurar (ni escribir) un cifrado',
        (pisado?.length ?? 0) === 0,
        `${pisado?.length ?? 0} filas afectadas`
      )
    }
  }

  // --- Acto 16: H23 · la partitura y su bucket ---------------------------------
  //
  // Dos capas de RLS que tienen que decir lo mismo: la fila (`partitura`) y los
  // archivos (`storage.objects`, con la huella en la ruta). El caso se arma acá
  // mismo —un borrador con una fuente de mentira— y se limpia al final con la
  // clave de servicio: no depende de que la semilla del ensayo esté subida.
  {
    const SECRETA = process.env.SUPABASE_SECRET_KEY
    const { data: coroDir } = await director.from('coro_acceso').select('coro_id').limit(1).single()
    const coroId = coroDir!.coro_id as string
    // Un canto del coro que todavía no tenga partitura publicada.
    const { data: conPartitura } = await director.from('partitura').select('canto_id')
    const ocupados = new Set((conPartitura ?? []).map((p) => p.canto_id))
    const { data: candidatos } = await director.from('cantos').select('id').eq('coro_id', coroId)
    const cantoId = (candidatos ?? []).map((c) => c.id).find((id) => !ocupados.has(id))!
    const huella = 'a'.repeat(64)
    const base = `${coroId}/${cantoId}/${huella}`
    const bucket = (c: typeof director) => c.storage.from('partituras')

    // Escribir la fila: el director sí, el miembro no.
    const { error: errMusico } = await musico.from('partitura').insert({
      canto_id: cantoId,
      coro_id: coroId,
      origen: 'musicxml',
      huella,
      ruta_fuente: `${base}/fuente.musicxml`,
    })
    comprobar('musico@ no puede subir una partitura (insert rechazado)', !!errMusico, errMusico?.message ?? 'se insertó')

    const { data: borrador, error: errDirector } = await director
      .from('partitura')
      .insert({ canto_id: cantoId, coro_id: coroId, origen: 'musicxml', huella, ruta_fuente: `${base}/fuente.musicxml` })
      .select('id')
      .single()
    comprobar('director@ puede subir una partitura en borrador', !!borrador, errDirector?.message ?? '1 fila')

    // Subir archivos: el director solo la FUENTE; las pistas son del conversor.
    const { error: errFuente } = await bucket(director).upload(`${base}/fuente.musicxml`, '<score-partwise/>', {
      contentType: 'application/xml',
      upsert: true,
    })
    comprobar('director@ puede subir la fuente al bucket', !errFuente, errFuente?.message ?? 'subida')
    const { error: errPistaDir } = await bucket(director).upload(`${base}/pistas/voces/tenor.mp3`, 'x', {
      contentType: 'audio/mpeg',
    })
    comprobar('ni el director sube una pista (eso es del conversor)', !!errPistaDir, errPistaDir?.message ?? 'se subió')
    const { error: errPistaMus } = await bucket(musico).upload(`${base}/fuente.musicxml`, 'x', { upsert: true })
    comprobar('musico@ no puede subir nada al bucket', !!errPistaMus, errPistaMus?.message ?? 'se subió')

    // Leer el borrador: solo el director.
    const { data: verMusico } = await musico.from('partitura').select('id').eq('canto_id', cantoId)
    const { data: verDirector } = await director.from('partitura').select('id').eq('canto_id', cantoId)
    comprobar(
      'el borrador lo ve el director y no el miembro',
      (verDirector?.length ?? 0) === 1 && (verMusico?.length ?? 0) === 0,
      `director ${verDirector?.length ?? 0} · musico ${verMusico?.length ?? 0}`
    )
    const firmaBorrador = await bucket(musico).createSignedUrl(`${base}/fuente.musicxml`, 60)
    comprobar('musico@ no puede firmar un archivo de un borrador', !!firmaBorrador.error, firmaBorrador.error?.message ?? 'firmó')

    // Publicada: la ve todo el coro, y nadie de fuera.
    await director
      .from('partitura')
      .update({ estado: 'publicada', publicada_at: new Date().toISOString() })
      .eq('id', borrador?.id ?? '')
    const firmaMusico = await bucket(musico).createSignedUrl(`${base}/fuente.musicxml`, 60)
    comprobar('publicada, musico@ firma y baja el archivo', !!firmaMusico.data?.signedUrl, firmaMusico.error?.message ?? 'firmada')
    const firmaAjeno = await bucket(ajeno).createSignedUrl(`${base}/fuente.musicxml`, 60)
    const { data: filaAjeno } = await ajeno.from('partitura').select('id').eq('canto_id', cantoId)
    comprobar(
      'ajeno@ no ve la fila ni puede firmar sus archivos',
      !!firmaAjeno.error && (filaAjeno?.length ?? 0) === 0,
      `${filaAjeno?.length ?? 0} filas · ${firmaAjeno.error?.message ?? 'firmó'}`
    )
    const { data: rutaRara } = await bucket(musico).createSignedUrl('no-es-un-uuid/x/y/z.mp3', 60)
    comprobar('una ruta mal formada no rompe la política: solo dice que no', !rutaRara?.signedUrl, 'sin firma')

    // La URL firmada vence: copiada a otra sesión deja de servir (H23-5, con 1 s en vez de 1 h).
    const corta = await bucket(musico).createSignedUrl(`${base}/fuente.musicxml`, 1)
    const antes = corta.data ? (await fetch(corta.data.signedUrl)).status : 0
    await new Promise((r) => setTimeout(r, 2500))
    const despues = corta.data ? (await fetch(corta.data.signedUrl)).status : 0
    comprobar('una URL firmada sirve mientras vale y después no', antes === 200 && despues >= 400, `${antes} → ${despues}`)

    // Se deja como estaba: la fila y el archivo, con la clave de servicio.
    if (SECRETA) {
      const servicio = createClient(URL, SECRETA, { auth: { autoRefreshToken: false, persistSession: false } })
      await servicio.storage.from('partituras').remove([`${base}/fuente.musicxml`, `${base}/pistas/voces/tenor.mp3`])
      await servicio.from('partitura').delete().eq('canto_id', cantoId).eq('huella', huella)
    } else {
      console.log('  (sin SUPABASE_SECRET_KEY: el caso de prueba de la partitura quedó en la base)')
    }
  }

  // --- Acto 17: H27 · el tono de cada canto en la misa ------------------------
  //
  // Sin política nueva: fijar el tono es escribir la fila de `misa_cantos`, que
  // ya es solo del director. Se comprueba en vez de suponerlo, y con la columna
  // nueva, que es la que esta vez importa.
  {
    const { data: fila } = await director.from('misa_cantos').select('id, transposicion').limit(1).single()
    const original = fila!.transposicion as number | null

    const { data: delMiembro } = await musico
      .from('misa_cantos')
      .update({ transposicion: 3 })
      .eq('id', fila!.id)
      .select('id')
    comprobar('musico@ no puede fijar el tono de un canto en la misa', (delMiembro?.length ?? 0) === 0, `${delMiembro?.length ?? 0} filas afectadas`)

    const { data: delDirector } = await director
      .from('misa_cantos')
      .update({ transposicion: 1 })
      .eq('id', fila!.id)
      .select('transposicion')
    const { data: loVeElMiembro } = await musico.from('misa_cantos').select('transposicion').eq('id', fila!.id).single()
    comprobar(
      'director@ fija el tono y el miembro lo lee',
      delDirector?.[0]?.transposicion === 1 && loVeElMiembro?.transposicion === 1,
      `director → ${delDirector?.[0]?.transposicion ?? '—'} · musico lee ${loVeElMiembro?.transposicion ?? '—'}`
    )

    const { error: fueraDeRango } = await director.from('misa_cantos').update({ transposicion: 12 }).eq('id', fila!.id)
    comprobar('ni el director guarda un tono fuera de −11…11', !!fueraDeRango, fueraDeRango?.message ?? 'se guardó')

    // Se deja como estaba.
    await director.from('misa_cantos').update({ transposicion: original }).eq('id', fila!.id)
  }

  // --- Acto 18: el orden de los cantos en cada momento (2026-10-17) -----------
  // Una columna nueva en `canto_momentos`; la política de escritura es la de
  // siempre (solo el director). Se comprueba que sigue mandando sobre ella.
  {
    const { data: vinculo } = await director.from('canto_momentos').select('id, orden').limit(1).single()
    const original = vinculo!.orden as number | null

    const { data: delMiembro } = await musico
      .from('canto_momentos')
      .update({ orden: 7 })
      .eq('id', vinculo!.id)
      .select('id')
    comprobar('musico@ no puede ordenar los cantos de un momento', (delMiembro?.length ?? 0) === 0, `${delMiembro?.length ?? 0} filas afectadas`)

    const { data: delDirector } = await director
      .from('canto_momentos')
      .update({ orden: 5 })
      .eq('id', vinculo!.id)
      .select('orden')
    comprobar('director@ ordena los cantos de un momento', delDirector?.[0]?.orden === 5, `orden → ${delDirector?.[0]?.orden ?? '—'}`)

    const { error: negativo } = await director.from('canto_momentos').update({ orden: -1 }).eq('id', vinculo!.id)
    comprobar('ni el director guarda un lugar negativo', !!negativo, negativo?.message ?? 'se guardó')

    await director.from('canto_momentos').update({ orden: original }).eq('id', vinculo!.id)
  }

  // --- Acto 19: arrastrar un canto a otro momento (2026-10-17) ----------------
  // Soltar un canto en otra sección cambia el `momento_id` de su vínculo. La
  // política es la misma (`canto_momentos_write`): solo el director del coro.
  {
    const { data: vinculo } = await director
      .from('canto_momentos')
      .select('id, canto_id, momento_id')
      .limit(1)
      .single()
    const { data: suyos } = await director.from('canto_momentos').select('momento_id').eq('canto_id', vinculo!.canto_id)
    const { data: todos } = await director.from('momentos_liturgicos').select('id')
    const ocupados = new Set((suyos ?? []).map((v) => v.momento_id))
    const otro = (todos ?? []).find((m) => !ocupados.has(m.id))!.id

    const { data: delMiembro } = await musico
      .from('canto_momentos')
      .update({ momento_id: otro })
      .eq('id', vinculo!.id)
      .select('id')
    comprobar('musico@ no puede cambiar un canto de momento', (delMiembro?.length ?? 0) === 0, `${delMiembro?.length ?? 0} filas afectadas`)

    const { data: delDirector } = await director
      .from('canto_momentos')
      .update({ momento_id: otro })
      .eq('id', vinculo!.id)
      .select('momento_id')
    comprobar('director@ cambia un canto de momento', delDirector?.[0]?.momento_id === otro, `momento → ${delDirector?.[0]?.momento_id ?? '—'}`)

    // Se deja como estaba.
    await director.from('canto_momentos').update({ momento_id: vinculo!.momento_id }).eq('id', vinculo!.id)
  }

  const fallidos = resultados.filter((r) => !r.ok)
  console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones en verde`)
  if (fallidos.length > 0) process.exit(1)
}

main().catch((e) => {
  console.error('✗ La verificación falló:', e.message ?? e)
  process.exit(1)
})
