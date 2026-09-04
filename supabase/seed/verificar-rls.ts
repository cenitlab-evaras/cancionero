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

  // EL ORDEN DE §8.4: primero aprobar, después vincular. El director NO puede
  // saltárselo, ni siquiera por acción directa.
  const { error: errAntesDeAprobar } = await director
    .from('coro_acceso')
    .insert({ perfil_id: idPendiente, coro_id: coroId, rol_local: 'miembro' })
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
    .insert({ perfil_id: idPendiente, coro_id: coroId, rol_local: 'miembro' })
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

  const fallidos = resultados.filter((r) => !r.ok)
  console.log(`\n${resultados.length - fallidos.length}/${resultados.length} comprobaciones en verde`)
  if (fallidos.length > 0) process.exit(1)
}

main().catch((e) => {
  console.error('✗ La verificación falló:', e.message ?? e)
  process.exit(1)
})
