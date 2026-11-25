# Modo simple — diseño

**2026-11-25** · Cantoral · el dueño eligió la opción 2 («Simple / Normal», simple
por defecto para el miembro) y pidió que «leer mejor» sea **tamaño y contraste**.

## Intención

El miembro que solo **lee la letra y se inscribe a la misa** no necesita el
repertorio completo, los filtros, el historial ni las herramientas del director.
Hoy entra a una app con cuatro destinos y un catálogo de cientos de cantos para
hacer dos cosas. El modo simple le deja solo esas dos cosas, con letra más
grande y un tema de alto contraste, sin quitarle la salida: puede volver al modo
normal cuando quiera.

**Para quién:** personas con rol local `miembro` en el coro activo.
**Para quién no:** directores y admin. El director ve la app como hoy. El admin
global nunca entra en simple (es la cuenta de instalación).

## Objetivos

1. **Menos pantallas:** tres destinos en la barra — **Mi misa · Misas · Más** — y
   ningún catálogo completo promocionado. «Canciones» desaparece del modo simple.
2. **Leer mejor:** letra sola, sin acordes, tamaño **Grande (28 px)** mientras la
   persona no haya elegido otro, y un tercer tema **Alto contraste**.
3. **Inscribirse en la misma pantalla:** la misa a la que va, con «Voy / No voy»
   y «Empezar», sin pasar por otra pantalla.
4. **Tener lo propio a mano:** sus **favoritas** personales (buscar, encontrar,
   anclar) y las **lecturas del domingo** que el director ya guardó, con un
   interruptor on/off.
5. **Reversible:** un interruptor en «Más» devuelve a la app completa, y desde
   el «Más» normal se puede volver a simple. Nada se borra.

## No objetivos

- No es otra app ni otra base: un preset de presentación sobre las mismas rutas,
  las mismas actions y la misma RLS.
- No cambia permisos ni capacidades. La matriz y la RLS mandan igual.
- No es un selector libre de colores: tres temas curados dentro del sistema de
  diseño (el ámbar sigue reservado a los acordes).
- No agrega un estado «borrador/publicado» a las lecturas: **lo guardado por el
  director cuenta como publicado** (decisión del dueño, 2026-11-25). El
  interruptor del miembro solo muestra u oculta lo que ya está cargado.
- No rediseña «Inicio» en modo normal (la lista de misas como tarjetas sigue
  pendiente de decisión A/B) ni la Configuración en cajas.

## Anti-objetivos

- Que el miembro quede encerrado sin forma de ver todo.
- Dos juegos de pantallas que se separen con el tiempo. Una ruta, dos variantes.
- Que el modo simple deje de mostrar un error, un vacío o una falta de acceso.

## Enfoques considerados

1. **Simple por rol, sin interruptor.** El miembro siempre ve el armazón simple.
   Menos decisiones, pero deja sin salida al que quiere explorar el repertorio.
2. **Interruptor Simple / Normal, simple por defecto para el miembro.** Elegida.
   Cumple el pedido y da salida; el costo es un estado más que mantener.
3. **Solo mejorar los defaults de lectura, sin modo.** Barato, pero no resuelve
   «menos pantallas».

## Diseño

### 1. La preferencia y el modo efectivo

- Migración `preferencias_perfil.modo text null check (modo in ('simple','normal'))`.
  `null` = todavía no eligió.
- **Motor puro, con test:** `modoEfectivo({ rol, rolLocal, guardado })`
  - `rol === 'admin'` → `normal` (siempre).
  - `rolLocal === 'director'` → `normal` (necesita sus herramientas).
  - sin coro activo → `normal` (aunque haya guardado `simple`).
  - `guardado` explícito (`simple`/`normal`) → ese.
  - `null` + `miembro` → `simple`.
- La preferencia es **de la persona**, no del dispositivo.
- Se lee en `obtenerSesion()` con un embed de `preferencias_perfil(modo)` en la
  consulta de `perfiles` (una consulta, no una nueva por pantalla) y se pasa a
  `Cabecera`/`BarraNav`.

### 2. Alcance de la variante simple

**Cambia:**

| Ruta | Variante simple |
|---|---|
| `/` | **Mi misa**: la misa a la que va, «Voy / No voy», «Empezar», sus cantos, «Tus favoritas» y, si el interruptor está prendido, las lecturas. Sin complejidad ni contexto. |
| `/mas` | Lista corta: Mi perfil · Mis coros (si hay más de 1) · **La app** (Tema · Lecturas del domingo · Modo) · Salir. Sin historial, sugerencias, herramientas, archivados, usuarios ni miembros. |
| Barra | Mi misa · Misas · Más. |
| Cabecera | Sin buscador global. |
| `/misas` | El calendario sigue igual (elegir otra misa e inscribirse). |
| `/misas/[id]` | Se ocultan el contexto (complejidad, celebración, lugar) y el lápiz; quedan fecha, cantos, «Empezar», inscripción y lecturas. |
| `/misas/[id]/[filaId]` | Lectura/ejecución con letra sola, sin acordes, sin transposición, sin «Ensayar», «Dar el tono» ni «Quién canta». Quedan «Anterior/Siguiente» y el tamaño. |
| `/repertorio/[cantoId]` | Se abre solo desde una favorita o un enlace viejo: misma lectura simple (letra, tamaño, sin acordes ni herramientas). |
| `/favoritas` | Pantalla nueva, fuera de la barra: buscar en el repertorio del coro, anclar y desanclar, abrir la lectura. |

**No se promociona** el catálogo completo (`/repertorio`, `/canciones`): no hay
enlace desde simple. Una URL vieja sigue funcionando (la RLS manda); no se
redirige para no romper un marcador.

### 3. «Mi misa»: qué misa

Decisión del dueño (2026-11-25): la misa a la que va, no siempre la próxima.

- La **próxima misa a la que el miembro se inscribió** (fecha futura), si hay.
  Es «la misa que voy a participar».
- Si no se inscribió a ninguna, la **próxima del coro** (`misaDeInicio`, hoy o la
  siguiente).
- Si está en varias inscripciones, la más cercana. Si la misa mostrada deja de
  ser futura, se recalcula al leer.
- «No voy» retira la inscripción (con la action existente) y la pantalla vuelve
  a resolver: si no queda otra inscripción, muestra la próxima del coro.

### 4. Inscripción en simple: «Voy / No voy»

Decisión del dueño (2026-11-25): en simple se dice solo **Voy** o **No voy**; no
se elige «A cantar / A tocar».

Para no falsear el resumen del director —hoy el aporte es obligatorio y solo
admite `vocal`/`instrumental`— se agrega un tercer aporte neutro:

- Migración: `misa_participante.aporte check (aporte in ('vocal','instrumental','asistencia'))`
  y se ajusta `instrumento_solo_si_toca` para exigir `instrumento is null` en
  `asistencia`.
- `APORTES` y `validarInscripcion` en `lib/motores/inscripcion.ts` aceptan
  `asistencia`; `etiquetaAporte` devuelve «Va».
- `resumirCoro` suma `asisten` como un grupo aparte: «3 van sin especificar».
  Las voces y los instrumentos no cambian para quien sí los declaró.
- El director ve esos nombres en «Quién va»; si necesita el detalle, el miembro
  puede pasar a normal y elegir «A cantar / A tocar».
- La inscripción normal (modo normal, o detalle de la misa) sigue con el control
  completo de dos opciones.
- Casos nuevos en `supabase/seed/verificar-rls.ts`: un miembro solo escribe su
  fila; `asistencia` sin instrumento es válida; `asistencia` con instrumento es
  rechazada.

### 5. Leer mejor

- **Sin acordes:** en simple, `mostrarAcordes` se fuerza a `false` en el motor de
  lectura (no con CSS: los acordes no salen en el HTML), igual que H11.
- **Tamaño:** migración `preferencias_perfil.tamano_letra_elegido boolean not null
  default false`.
  - Backfill: `true` para las filas con `tamano_letra` 18 o 28 (elecciones
    deliberadas); las de 22 quedan `false` (era el default). Un 22 elegido a
    propósito pasa a Grande en simple; se puede volver a Regular desde «Aa».
  - La action de tamaño pone `tamano_letra_elegido = true` siempre.
  - Motor puro `tamanoDeLectura({ modo, guardado, elegido })`:
    simple + no elegido → **Grande (28 px)**; resto → el guardado.
- **Tema Alto contraste:** tercer valor `alto` en `Tema` (cookie `cantoral_tema`),
  con su bloque de tokens en `globals.css` (fondo negro, texto blanco, bordes y
  acento con contraste ≥ 7:1; el ámbar de los acordes se mantiene).
  - `COLOR_BARRA` y `esTema` incluyen `alto`.
  - El conmutador de la cabecera cicla tres temas (Noche → Papel → Alto → Noche)
    con un ícono propio para el alto contraste y nombre accesible.
  - En «Más» del modo simple, una fila **Tema** con las tres opciones.
- **Lectura:** la manija y el lector no cambian de estructura; solo sus valores
  por defecto y las herramientas que se ocultan.

### 6. Favoritas personales

- **Tabla** `canto_favorito`:
  - `perfil_id uuid not null references perfiles(id) on delete cascade`
  - `canto_id uuid not null references cantos(id) on delete cascade`
  - `created_at timestamptz not null default now()`
  - PK `(perfil_id, canto_id)`.
- **RLS** (activa en la misma migración):
  - `select`: `perfil_id = auth.uid()`.
  - `insert`: `perfil_id = auth.uid()` **y** `exists (select 1 from public.cantos c where c.id = canto_id)`
    — la subconsulta pasa por la RLS de `cantos`, así que solo se puede anclar un
    canto visible para esa persona.
  - `delete`: `perfil_id = auth.uid()`.
  - Sin `update` (no hay nada que actualizar).
- **Pantalla `/favoritas`:** buscador (URL `?q=`, motor `lib/motores/busqueda.ts`)
  sobre los cantos visibles del coro activo; resultados con un botón **anclar**;
  arriba, las ancladas visibles del coro activo, con **soltar**. Tocar una abre
  su lectura simple. Se llega desde «Tus favoritas» en Mi misa.
- **Server action** `anclarFavorito(cantoId, anclar)` en `app/favoritas/acciones.ts`:
  `obtenerSesion()` → `puede(..., 'leer_canto')` → zod uuid → upsert/delete con la
  sesión del usuario. La RLS vuelve a decidir.
- **Varios coros:** la fila no lleva `coro_id`; la lista filtra por lo visible en
  el coro activo y excluye archivados. Cambiar de coro no borra favoritas.

### 7. Lecturas del domingo on/off

- Preferencia `preferencias_perfil.mostrar_lecturas boolean not null default false`.
- En simple, «Mi misa» lee las lecturas de la misa mostrada y, si el interruptor
  está prendido, las muestra con el lector existente (`BloqueLecturas` con
  `esDirector={false}`).
- Interruptor **«Lecturas del domingo»** en «Más → La app», apagado por defecto.
- Si la misa no tiene lecturas guardadas, el bloque no aparece; el interruptor
  lo explica («Esta misa todavía no tiene lecturas»).
- Lo ya guardado por el director es lo publicado; no hay estado intermedio.

### 8. Primera vez y reversibilidad

- Quien nunca eligió (`modo = null`) y es miembro entra en simple. En «Mi misa»,
  una tarjeta chica y no bloqueante pregunta: **«¿Querés ver todo?»** con dos
  acciones: «Así está bien» (guarda `simple`) y «Ver todo» (guarda `normal`).
  Hasta que responda, la tarjeta sigue ahí.
- En «Más» del modo simple, el interruptor **Simple / Normal**.
- En el «Más» normal, para miembros, una fila **«Modo simple»** que guarda
  `simple`. Así la decisión es reversible en las dos direcciones.

### 9. Lo que el modo simple no toca

- La RLS, las actions y la matriz de permisos.
- Los estados de error, vacío y sin-acceso: se siguen explicando.
- El director y el admin: aunque la persona tenga `modo = simple`, el motor
  resuelve `normal`.

## Riesgos y cuidados

- **Deriva entre variantes:** la variante simple reutiliza los componentes de la
  misa, la lista de cantos y el lector; no los copia.
- **Modo que oculta algo necesario:** si un miembro necesita «Dar el tono» o
  «Quién canta», lo recupera con «Ver todo»; la tarjeta y el interruptor tienen
  que ser visibles.
- **Aporte neutro:** `asistencia` no debe contarse como voz ni como instrumento,
  y el director tiene que poder distinguirlo en «Quién va».
- **Tema de alto contraste:** las cuerdas y el ámbar deben mantener contraste; se
  verifican a ojo y con los ratios del DESIGN.
- **Cookie de tema:** un valor `alto` viejo no debe romper `esTema`; se agrega al
  tipo y a la validación.

## Verificación

- Tests puros: `modoEfectivo` (admin, director, miembro, null, sin coro, simple
  explícito sin coro), `tamanoDeLectura` (simple sin elegir, simple con elección,
  normal) y `validarInscripcion` con `asistencia`.
- `tsc`, `eslint`, `npm test`, `npm run build`, `npm run verificar:rls` con los
  casos nuevos de `canto_favorito` y `misa_participante`.
- Playwright a 360 px con `musico@cantoral.local`:
  1. La barra tiene tres destinos y no aparece «Canciones».
  2. «Mi misa» muestra la misa inscrita (o la próxima), «Voy / No voy», y al
     inscribirse aparece la lista de quiénes van.
  3. La lectura abre en 28 px, sin acordes y sin herramientas de director.
  4. Buscar un canto, anclarlo y verlo en «Tus favoritas»; desanclarlo.
  5. Prender «Lecturas del domingo» y ver las lecturas guardadas de la misa.
  6. Elegir Alto contraste en Más y mantenerlo al recargar.
  7. «Normal» devuelve la app completa y desde el Más normal se vuelve a simple.
- Con `director@cantoral.local` y `admin@cantoral.local`: la app no cambia.

## Pendiente, fuera de este diseño

- Inicio en modo normal: misas como tarjetas de Kanban (decisión A/B abierta).
- Configuración en cajas (Miembro / Repertorio / Historial / Administración) y
  «Coros de otros lados».
- Multi-coro de otra parroquia.
- ExtraHosts de producción.
