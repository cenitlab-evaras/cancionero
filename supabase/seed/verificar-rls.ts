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

  // --- H6 · Celebraciones ----------------------------------------------------
  // Solo corren si hay una celebración armada; la semilla no crea ninguna.
  const { data: celebracion } = await director
    .from('celebraciones')
    .select('id, coro_id, nombre')
    .limit(1)
    .maybeSingle()

  if (!celebracion) {
    console.log('\n· sin celebraciones armadas: se omiten las comprobaciones de H6')
  } else {
    const { data: veMusico } = await musico.from('celebraciones').select('id').eq('id', celebracion.id)
    comprobar(
      'musico@ ve la celebración de su coro',
      (veMusico?.length ?? 0) === 1,
      `${veMusico?.length ?? 0} filas`
    )

    const { data: veAjeno } = await ajeno.from('celebraciones').select('id').eq('id', celebracion.id)
    comprobar(
      'ajeno@ pidiendo la celebración por id recibe CERO filas',
      (veAjeno?.length ?? 0) === 0,
      `${veAjeno?.length ?? 0} filas`
    )

    const { data: vePendiente } = await pendiente.from('celebraciones').select('id')
    comprobar(
      'pendiente@ (no aprobado) no obtiene ninguna celebración',
      (vePendiente?.length ?? 0) === 0,
      `${vePendiente?.length ?? 0} filas`
    )

    const { error: errCrear } = await musico
      .from('celebraciones')
      .insert({ coro_id: celebracion.coro_id, nombre: 'intento de un músico' })
    comprobar(
      'musico@ no puede crear una celebración (la RLS lo frena)',
      !!errCrear,
      errCrear ? 'la RLS rechazó el insert' : 'SE ESCRIBIÓ: la política está mal'
    )

    const { data: unMomento } = await musico.from('momentos_liturgicos').select('id').limit(1).single()
    const { error: errAgregar } = await musico.from('celebracion_cantos').insert({
      celebracion_id: celebracion.id,
      canto_id: idAjeno!,
      momento_id: unMomento!.id,
      orden: 999,
      coro_id: celebracion.coro_id,
    })
    comprobar(
      'musico@ no puede agregar un canto a la misa',
      !!errAgregar,
      errAgregar ? 'la RLS rechazó el insert' : 'SE ESCRIBIÓ: la política está mal'
    )

    const { data: antes } = await musico
      .from('celebracion_cantos')
      .select('id, orden')
      .eq('celebracion_id', celebracion.id)
      .order('orden')
    await musico.from('celebracion_cantos').delete().eq('id', antes![0]!.id)
    const { data: despues } = await musico
      .from('celebracion_cantos')
      .select('id')
      .eq('celebracion_id', celebracion.id)
    comprobar(
      'musico@ no puede quitar un canto de la misa',
      (despues?.length ?? 0) === (antes?.length ?? 0),
      `${antes?.length ?? 0} antes, ${despues?.length ?? 0} después`
    )

    const { data: escrituraDirector } = await director
      .from('celebraciones')
      .update({ nombre: celebracion.nombre })
      .eq('id', celebracion.id)
      .select('id')
    comprobar(
      'director@ sí puede editar la celebración de su coro',
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

  // --- H7 · Gobernar el coro -------------------------------------------------
  const admin = await sesion('admin@cantoral.local')

  const { data: coroMusico2 } = await musico.from('coro_acceso').select('coro_id').limit(1).single()
  const coroId = coroMusico2!.coro_id
  const idPendiente = (
    await admin.from('perfiles').select('id').eq('email', 'pendiente@cantoral.local').single()
  ).data!.id

  // El músico no gobierna: ni admite gente ni cambia roles.
  const { error: errAdmitir } = await musico
    .from('coro_acceso')
    .insert({ perfil_id: idPendiente, coro_id: coroId, rol_local: 'musico' })
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

  const { error: errCoro } = await musico.from('coros').insert({ nombre: 'Coro del músico' })
  comprobar(
    'musico@ no puede crear un coro',
    !!errCoro,
    errCoro ? 'la RLS rechazó el insert' : 'SE ESCRIBIÓ: la política está mal'
  )

  // EL ORDEN DE §8.4: primero aprobar, después vincular. El director NO puede
  // saltárselo, ni siquiera por acción directa.
  const { error: errAntesDeAprobar } = await director
    .from('coro_acceso')
    .insert({ perfil_id: idPendiente, coro_id: coroId, rol_local: 'musico' })
  comprobar(
    'director@ NO puede vincular a un perfil sin aprobar (§8.4, el orden del alta)',
    !!errAntesDeAprobar,
    errAntesDeAprobar ? 'la RLS rechazó el insert' : 'SE VINCULÓ: la política está mal'
  )

  // El admin aprueba…
  await admin.from('perfiles').update({ aprobado: true }).eq('id', idPendiente)
  const { data: yaAprobado } = await admin
    .from('perfiles')
    .select('aprobado')
    .eq('id', idPendiente)
    .single()
  comprobar('admin@ sí puede aprobar un perfil', yaAprobado?.aprobado === true, 'aprobado')

  // …y recién ahí el director puede vincularlo.
  const { data: vinculado, error: errVincular } = await director
    .from('coro_acceso')
    .insert({ perfil_id: idPendiente, coro_id: coroId, rol_local: 'musico' })
    .select('id')
  comprobar(
    'director@ sí puede vincular al perfil YA aprobado',
    (vinculado?.length ?? 0) === 1,
    errVincular ? `error: ${errVincular.message}` : '1 fila'
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

  // Se deja como estaba: la semilla vuelve a tener a pendiente@ sin aprobar.
  await director.from('coro_acceso').delete().eq('perfil_id', idPendiente)
  await admin.from('perfiles').update({ aprobado: false }).eq('id', idPendiente)

  // --- H8 · Editar el repertorio ---------------------------------------------
  const { data: coroDelMusico } = await musico.from('coro_acceso').select('coro_id').limit(1).single()

  const { error: errCrearCanto } = await musico.from('cantos').insert({
    coro_id: coroDelMusico!.coro_id,
    titulo: 'Canto del músico',
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

  const { error: errAutorMusico } = await musico.from('autores').insert({ nombre: 'Autor del músico' })
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
  // estado que no existe. `archivado` está fuera a propósito (§17).
  const { error: errEstadoInvalido } = await director
    .from('cantos')
    .update({ estado: 'archivado' })
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
    'director@ NO ve la preferencia de perfil del músico',
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

  const fallidos = resultados.filter((r) => !r.ok)
  console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones en verde`)
  if (fallidos.length > 0) process.exit(1)
}

main().catch((e) => {
  console.error('✗ La verificación falló:', e.message ?? e)
  process.exit(1)
})
