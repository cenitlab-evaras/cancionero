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

1. **Se guardan por misa**, no se traen de una API en el momento. El director las carga una vez y
   quedan en la base: es la única forma de garantizar la lectura en una iglesia sin señal.
2. **Se leen en una capa a pantalla completa sobre la misma página**, no en una ruta aparte:
   abrirla no pide red si la misa ya está cargada.
3. **Dos puertas a la misma capa**: una desde la misa (para preparar) y otra desde la ejecución
   (para leer durante la celebración).
4. **Un solo pegado con separadores**: el director copia el bloque de la fuente oficial y la app
   reparte «Primera lectura», «Salmo responsorial», «Segunda lectura» y «Evangelio»; después cada
   parte se corrige a mano.
5. **Al sugerir se ven las lecturas de esa misa** y se puede dejar un **«por qué» opcional**; el
   director lo ve junto al pedido.

## Objetivos

- Guardar por misa hasta cuatro partes: primera lectura, salmo responsorial, segunda (opcional) y
  evangelio, cada una con referencia y texto.
- Leerlas a pantalla completa, con el texto grande, cambio de parte y pantalla encendida, sin red
  al abrirlas mientras la página está cargada.
- Mostrar las lecturas en el formulario de sugerencia y guardar una nota breve del que propone.
- Que la lectura no estorbe: si una misa no tiene lecturas, la app se comporta como hoy.

## No objetivos de esta versión

- Traer automáticamente las lecturas por fecha o calendario litúrgico (ciclos A/B/C, solemnidades).
- Usar IA para buscar, resumir o generar lecturas (PRD §16).
- Descargar de una API de terceros en tiempo de ejecución.
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
- El texto lo aporta el director desde la fuente oficial; la app no lo descarga.

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
| `created_at` / `updated_at` | timestamptz | |

- `unique (misa_id, tipo)` y `unique (id, coro_id)`.
- RLS: **select** `puede_ver_coro(coro_id)`; **write** `es_director_de(coro_id)` (el mismo
  portón que las misas).
- Índice por `(misa_id)` (el unique ya lo cubre) y por `coro_id`.

**`sugerencia.nota`**: columna `text` nullable, tope 280 caracteres validado en la action y con
`check (char_length(nota) <= 280)`. La RLS de `sugerencia` no cambia: la nota la escribe quien
propone y la ve el coro.

### Motor puro · `lib/motores/lecturas.ts`

`repartirLecturas(texto: string): ParteDeLectura[]`

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
- El editor es una hoja dentro de la misa (no el armador): un textarea «Pegá las lecturas», botón
  «Repartir», y las cuatro partes con referencia y texto editables; la segunda puede quedar vacía.
  Aviso de fuente: «Pegá el texto de la fuente oficial; la app no lo descarga».

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
| Origen de las lecturas | API por fecha; solo referencias | Guardar por misa es la única que lee sin señal y no depende de un tercero |
| Lector | Ruta propia; tarjeta en la misa | La capa evita la petición de red al abrir y comparte código entre las dos puertas |
| Carga | Campos separados; importar URL | Un pegado con reparto es el menor trabajo por misa; los campos quedan para corregir |
| Sugerencias | Solo mostrar; tablero por lectura | La nota convierte la propuesta en argumento con una columna y un campo; el tablero es otro hito |

## Lo que queda al builder

- La heurística exacta de encabezados y referencias, y sus tests.
- El formato de la hoja de edición y del lector (spacing, tabs, tamaños) dentro de los tokens.
- Los casos nuevos de `verificar-rls.ts` (miembro lee, ajeno no, director escribe, miembro no).
- El nombre de la migración y los detalles de la FK compuesta.
- Cómo se muestra la nota cuando hay varias en el mismo pedido.

## Riesgos

- **Formatos de pegado**: si la fuente cambia, el reparto puede fallar; por eso el editor siempre
  muestra las cuatro partes y nunca descarta texto.
- **Texto largo**: el lector debe paginar/scroll con comodidad; se prueba a 360 px con el tamaño
  máximo de letra.
- **Derechos**: el texto se guarda para el coro, no se publica; la UI cita la fuente.
- **RLS**: el caso «miembro intenta escribir» debe devolver error, no un ok silencioso.
