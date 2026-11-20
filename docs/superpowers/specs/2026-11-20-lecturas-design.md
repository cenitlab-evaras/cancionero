# Las lecturas del domingo en la app · diseño

**Fecha**: 2026-11-20 · **Estado**: propuesto, pendiente de aprobación del dueño.

## Intención

Que el coro tenga **las lecturas de cada misa dentro de la app**, las pueda leer en el teléfono
mientras se celebra, y que al proponer una canción vea el texto que motiva la celebración. Hoy la
app no tiene lecturas ni calendario litúrgico: la misa tiene fecha y nombre, y las sugerencias se
atan al **momento** (Entrada, Comunión…), no a lo que se lee ese domingo.

La promesa del producto es «el cancionero de tu coro en el teléfono»; esto la extiende al otro
texto que se lee en la misma celebración, sin meter una segunda app.

## Decisiones tomadas con el dueño

1. **Se traen de Iglesia.cl y se guardan por misa.** La fuente es la página pública
   **«Evangelio del día» de iglesia.cl**, que embebe *Eucaristía Diaria* del Arzobispado de
   Santiago: `https://www.eucaristiadiaria.cl/dia_cal.php?fecha=AAAA-MM-DD` (verificado: trae la
   Liturgia de la Palabra completa, con referencias). Se piden **una vez por misa**, desde el
   servidor, y quedan en la base: así se leen sin señal y no se depende del sitio en plena
   celebración.
2. **Se leen en una capa a pantalla completa sobre la misma página**, no en una ruta aparte:
   abrirla no pide red si la misa ya está cargada.
3. **Dos puertas a la misma capa**: una desde la misa (para preparar) y otra desde la ejecución
   (para leer durante la celebración).
4. **Traer desde Iglesia.cl con un toque**, por la fecha de la misa; la app reparte «Primera
   lectura», «Salmo responsorial», «Segunda lectura» y «Evangelio», y después cada parte se puede
   corregir a mano. Si el sitio no responde o el texto viene distinto, queda el pegado manual como
   respaldo.
5. **Al sugerir se ven las lecturas de esa misa** y se puede dejar un **«por qué» opcional**; el
   director lo ve junto al pedido.

## Objetivos

- Guardar por misa hasta cuatro partes: primera lectura, salmo responsorial, segunda (opcional) y
  evangelio, cada una con referencia y texto, **traídas de Iglesia.cl** por la fecha de la misa con
  un toque y corregibles.
- Leerlas a pantalla completa, con el texto grande, cambio de parte y pantalla encendida, sin red
  al abrirlas mientras la página está cargada.
- Mostrar las lecturas en el formulario de sugerencia y guardar una nota breve del que propone.
- Que la lectura no estorbe: si una misa no tiene lecturas, la app se comporta como hoy.

## No objetivos de esta versión

- Traer automáticamente las lecturas por fecha o calendario litúrgico (ciclos A/B/C, solemnidades).
- Usar IA para buscar, resumir o generar lecturas (PRD §16).
- Depender de una API de terceros o raspar el sitio en cada visita: se pide una vez por misa y se
  guarda. No hay scraping de fondo ni de fechas que no se usan.
- Garantizar lectura con la app **cerrada y reabierta sin señal** (haría falta el service worker,
  que sigue pendiente).
- Editar lecturas desde «Armar la misa»: el armador sigue siendo solo cantos y tono.

## Anti-objetivos

- Copiar texto del leccionario sin permiso o sin citar la fuente.
- Obligar a cargar lecturas para poder armar una misa.
- Cambiar la lectura del canto, el armador o el flujo de sugerencias más de lo necesario.
- Una pantalla de lectura que dependa de la red justo durante la celebración.

## Restricciones

- RLS activa en la misma migración que crea la tabla; los casos se agregan a
  `supabase/seed/verificar-rls.ts`.
- Motores puros en `lib/motores/` con tests: el reparto del texto pegado es lógica pura.
- Cero valores derivados persistidos: el orden de las partes y los avisos se calculan al leer.
- La UI, los comentarios y los mensajes en español; los 44 px táctiles y los tokens de DESIGN.md.
- La fuente es la página pública de Iglesia.cl (Eucaristía Diaria, Arzobispado de Santiago); la
  app la consulta **desde el servidor**, una vez por misa, y cita la fuente. Si el sitio no
  responde o cambia, el director puede pegar o corregir el texto a mano.

## Diseño

### Datos

**`misa_lectura`** (nueva): una fila por parte y misa.

| columna | tipo | notas |
|---|---|---|
| `id` | uuid pk | |
| `misa_id` | uuid | FK compuesta con `coro_id` → `misas(id, coro_id)`, `on delete cascade` |
| `coro_id` | uuid | denormalizado para la RLS |
| `tipo` | text | `primera` · `salmo` · `segunda` · `evangelio` |
| `referencia` | text | «Is 63,16b-17.19b; 64,2-7»; puede quedar vacía |
| `texto` | text | el cuerpo, con saltos de línea |
| `fuente` | text | `iglesia.cl` o `manual` |
| `fuente_url` | text | la URL exacta de la que se trajo, para citarla y reintentar |
| `traido_en` | timestamptz | cuándo se importó por última vez |
| `created_at` / `updated_at` | timestamptz | |

- `unique (misa_id, tipo)` y `unique (id, coro_id)`.
- RLS: **select** `puede_ver_coro(coro_id)`; **write** `es_director_de(coro_id)` (el mismo
  portón que las misas).
- Índice por `(misa_id)` (el unique ya lo cubre) y por `coro_id`.

**`sugerencia.nota`**: columna `text` nullable, tope 280 caracteres validado en la action y con
`check (char_length(nota) <= 280)`. La RLS de `sugerencia` no cambia: la nota la escribe quien
propone y la ve el coro.

### Fuente · importador de Iglesia.cl

`lib/datos/lecturas-iglesia.ts` (servidor):

- `traerLecturasDeIglesia(fecha): Promise<ParteDeLectura[]>` — `fetch` a
  `https://www.eucaristiadiaria.cl/dia_cal.php?fecha=AAAA-MM-DD`, con timeout, `User-Agent`
  identificable y sin reintentos en cadena. Verifica que el título de la página corresponda a la
  fecha pedida; si no, falla con un mensaje claro.
- El parseo vive en un motor puro `extraerLecturasDeIglesia(html)` (con fixtures guardados de dos
  domingos: uno con segunda lectura y otro sin ella), para que un cambio del sitio se detecte en un
  test y no en la iglesia.
- Si el sitio falla, la app no inventa: muestra «No pudimos traerlas; pegá o editá el texto» y
  conserva lo que ya estuviera guardado.
- Atribución visible en el lector: «Fuente: Iglesia.cl · Eucaristía Diaria».

### Motor puro · `lib/motores/lecturas.ts`

`repartirLecturas(texto: string): ParteDeLectura[]` — **respaldo** para el pegado manual.

- Reconoce encabezados habituales, sin distinguir mayúsculas ni tildes: «Primera lectura», «Salmo
  responsorial», «Segunda lectura», «Evangelio», «Lectura del santo evangelio…», «Aclamación».
- La **referencia** es lo que sigue al encabezado en la misma línea o la línea siguiente, si
  parece una cita bíblica; si no, queda vacía.
- Devuelve solo las partes encontradas, en el orden litúrgico, con su texto recortado.
- Si no reconoce ningún encabezado, devuelve **una sola parte** con todo el texto en `primera` y
  un aviso (`reconocido: false`), para que el director lo reparta a mano. Nunca descarta texto.
- Tests: encabezados con mayúsculas y sin tildes; salmo con estribillo; segunda ausente; referencia
  en la línea siguiente; texto sin encabezados; texto vacío.

Constantes: `PARTES = ['primera','salmo','segunda','evangelio']` y sus nombres visibles.

### Datos y acciones

- `lecturasDeMisa(misaId): Promise<ParteDeLectura[]>` — lectura para la misa y la ejecución.
- `traerLecturasDeIglesia(misaId)` — server action del director: lee la fecha de la misa, llama al
  importador, upsert por parte con `fuente = 'iglesia.cl'` y `fuente_url`; revalida. Una misa sin
  fecha no puede traerlas (mensaje claro y el pegado sigue disponible).
- `lecturasDeVariasMis(ids): Promise<Map<misaId, ParteDeLectura[]>>` — para el formulario de
  sugerencia (solo las próximas misas que se muestran).
- `guardarLecturas({ misaId, partes })` — server action; exige `es_director_de` / `editar_misa`;
  upsert por `(misa_id, tipo)` y borra las partes que llegan vacías; valida largos y tipos;
  `revalidatePath` de la misa y la ejecución. Mensajes claros si la RLS rechaza (update afectó
  cero filas → error, no ok).
- `sugerirCanto` acepta `nota?: string` (≤280), la guarda y la devuelve en el dominio.

### Pantallas

**Misa** (`/misas/[id]`)

- Si hay lecturas, un bloque «Lecturas» con las referencias y un botón **«Leer»** que abre la capa.
- El director ve además **«Agregar lecturas» / «Editar lecturas»**.
- El editor es una hoja dentro de la misa (no el armador): botón **«Traer de Iglesia.cl»** por la
  fecha de la misa, y las cuatro partes con referencia y texto editables; la segunda puede quedar
  vacía. Debajo, «Pegar a mano» abre el textarea de respaldo («Pegá las lecturas» + «Repartir»).
  Aviso de fuente: la app las trae de Iglesia.cl; si el sitio no responde, se pegan o editan.

**Lector** (capa a pantalla completa, misma en las dos puertas)

- Cabecera: cerrar, nombre de la misa/fecha.
- Conmutador de partes presentes (1.ª · Salmo · 2.ª · Evangelio); sin partes vacías.
- Texto con el tamaño de letra de la persona (`tamanoLetra`) y un control `Aa` compacto.
- `PantallaEncendida` mientras está abierta.
- Cierre con la X, Esc, o volviendo atrás; no navega ni pide red.

**Ejecución** (`/misas/[id]/[filaId]`)

- Un botón **«Lecturas»** en la cinta superior o en la fila del pie, que abre la misma capa; al
  cerrar se vuelve al canto en el mismo punto.

**Sugerir** (ficha del canto)

- Al elegir una misa, se despliegan sus lecturas (si las tiene) en un bloque plegable.
- Campo «Por qué lo proponés (opcional)», máx. 280, con el texto de la lectura a la vista.
- En «Pedidos para esta misa» el director ve la nota junto al canto y a quién lo pidió.

### Offline

La capa funciona sin red mientras la página que la contiene esté cargada: las lecturas viajan con
la misa. Si la app se cierra y se reabre sin señal, no hay lectura (fuera de alcance; service
worker pendiente). Esto se dice en el diseño y no se promete en la UI.

## Aproximaciones consideradas

| Decisión | Alternativas | Por qué la elegida |
|---|---|---|
| Origen de las lecturas | API por fecha; solo referencias | Traer de la página pública de Iglesia.cl y **guardar por misa**: se lee sin señal y no se depende del sitio durante la celebración |
| Lector | Ruta propia; tarjeta en la misa | La capa evita la petición de red al abrir y comparte código entre las dos puertas |
| Carga | Solo pegado; importar al vuelo cada visita | «Traer de Iglesia.cl» una vez por misa con el pegado como respaldo: menos trabajo y el sitio no se raspa en cada visita |
| Sugerencias | Solo mostrar; tablero por lectura | La nota convierte la propuesta en argumento con una columna y un campo; el tablero es otro hito |

## Lo que queda al builder

- La heurística exacta de encabezados y referencias, y sus tests.
- El formato de la hoja de edición y del lector (spacing, tabs, tamaños) dentro de los tokens.
- Los casos nuevos de `verificar-rls.ts` (miembro lee, ajeno no, director escribe, miembro no).
- El nombre de la migración y los detalles de la FK compuesta.
- Cómo se muestra la nota cuando hay varias en el mismo pedido.

## Riesgos

- **El sitio cambia o no responde**: el parseo tiene fixtures y el editor siempre muestra las
  cuatro partes; si la traída falla, se pega o corrige a mano y nunca se descarta texto.
- **Fecha equivocada**: el importador verifica que la página corresponda a la fecha pedida antes de
  guardar; una misa sin fecha no trae nada.
- **Cortesía con el sitio**: una petición por misa, sin scraping de fondo ni de fechas que no se
  usan; se cita la fuente.
- **Texto largo**: el lector debe paginar/scroll con comodidad; se prueba a 360 px con el tamaño
  máximo de letra.
- **Derechos**: el texto se guarda para el coro, no se publica; la UI cita la fuente.
- **RLS**: el caso «miembro intenta escribir» debe devolver error, no un ok silencioso.

## Notas del revisor independiente

Verificado desde el propio VPS de producción (2026-11-20): `dia_cal.php?fecha=` responde 200 con
31–60 KB y las lecturas para fechas de 2026; para 2027 devuelve un marcador de 9,5 KB **sin
lecturas**. El servidor de producción puede llegar al sitio, así que el importador es viable.

### Decisiones que no cambian el alcance (tomadas acá)

- **Aclamación**: va al comienzo de la parte `evangelio`; no suma una quinta pestaña.
- **Pegado con texto no reconocido**: se conserva en la parte más cercana y se avisa; nunca se
  descarta texto.
- **Reimportar**: «Traer de Iglesia.cl» muestra las partes y **pide confirmación** antes de
  reemplazar. Si el parseo es parcial o falla, no escribe nada. La escritura va por una función
  `guardar_lecturas` (una transacción) para que no queden partes mezcladas.
- **Fuente por parte**: cada parte guarda `fuente` y `fuente_url`; editar una parte la marca
  `manual`. El lector cita la fuente de la parte visible y avisa si fue editada.
- **Ventana de fechas**: si la página no trae la fecha pedida o no tiene lecturas (p. ej. 2027),
  el botón dice «Iglesia.cl todavía no publicó las lecturas de ese día; pegalas a mano». La hoja
  del editor tiene un campo de fecha (por defecto la de la misa) solo para la importación; editar
  la fecha de la misa queda fuera de alcance.
- **Nota de la sugerencia**: solo cuando la propuesta es para una misa; la base lo exige
  (`nota is null or misa_id is not null`). Si la persona ya propuso, puede agregar o cambiar su
  nota en la misma fila; las propuestas generales no llevan nota.

### Pendiente de decisión del dueño

1. **Días complejos**: Navidad tiene tres formularios en la misma página, la Vigilia pascual
   siete lecturas, hay secuencias y misas vespertinas anticipadas. ¿La importación se acota al día
   ordinario (y esos días se pegan a mano), o se soportan formularios y lecturas extra?
2. **Uso del texto y fixtures**: confirmar el uso privado y la atribución («Iglesia.cl ·
   Eucaristía Diaria, Arzobispado de Santiago»), y que los fixtures del repo público sean
   sintéticos —misma estructura, sin texto real— para no publicar el leccionario.
