# Carga de cantos del administrador — diseño

**2026-11-25** · Cantoral · el dueño eligió: crear cantos es solo del admin
(formulario + import), el director sigue editando los existentes; se aceptan
`.txt`, texto pegado y PDF **con capa de texto** (los escaneos se rechazan); y el
admin elige a qué coro entra el canto.

## Intención

El repertorio crece de a poco y con criterio. Hoy el alta vive en Herramientas y
la puede hacer cualquier director; el dueño quiere que **la creación de un canto
sea una decisión del administrador**, desde Configuración, y que pueda entrar
desde lo que ya tiene a mano: un `.txt`, un texto pegado o el PDF de un cifrado.
El director no pierde lo suyo: sigue corrigiendo y editando lo que ya existe.

## Objetivos

1. **Un solo lugar para crear:** Configuración → Repertorio → **Cargar una
   canción**, visible solo para el admin.
2. **Tres entradas:** formulario a mano, texto pegado/`.txt`, y PDF con texto.
3. **Elegir el coro:** el admin decide a qué coro entra, aunque no pertenezca a
   ese coro.
4. **Previsualizar antes de guardar:** la app propone el ChordPro; el admin lo
   revisa, corrige y recién entonces guarda.
5. **No inventar:** si el PDF no trae texto o el formato no se reconoce, se dice
   y no se guarda nada.

## No objetivos

- No es un importador masivo: es **un canto por vez**. El cancionero completo
  sigue por el flujo externo (`importar:cancionero`).
- No hay OCR ni visión: un PDF escaneado se rechaza.
- No se guarda el PDF ni ningún binario: se procesa en memoria y se descarta
  (PRD §16).
- No cambia la edición de un canto existente: el director la conserva.
- No rediseña toda la Configuración en cajas; esta es la primera caja.

## Anti-objetivos

- Que un director pueda crear un canto por la puerta de atrás (la RLS también
  tiene que impedirlo, no solo la UI).
- Que un PDF mal leído entre al repertorio con acordes inventados.
- Que el archivo quede en el servidor o en Storage.

## Enfoques considerados

1. **Solo el import es admin-only, el formulario sigue para el director.** No
   cumple «crear es del admin»: el director seguiría creando a mano.
2. **Crear es del admin (formulario + import); editar sigue del director.**
   Elegida. Separa dos capacidades y conserva el trabajo de corrección.
3. **Todo el repertorio, solo admin.** Más de lo pedido: al director le quita
   también la corrección, que es justo lo que el producto valora (§17.1).

## Diseño

### 1. Permisos: crear y editar se separan

- Nueva capacidad **`crear_canto`** en `lib/permisos.ts`:
  - `admin: true`
  - `usuario: false` (aunque sea director)
  - `externo: false`
- **`editar_canto` queda igual:** `admin: true`, `usuario: 'solo_director'`.
  Editar, corregir, archivar y versionar no cambian.
- El alta manual (`/repertorio/nuevo`) y el import usan `crear_canto`.
- La edición (`/repertorio/[id]/editar`, corregir, archivar) sigue con
  `editar_canto`.
- Herramientas deja de ofrecer «Cargar un canto nuevo»; la fila desaparece.
  Configuración la reemplaza para el admin.

### 2. RLS: la creación también se cierra

Hoy `cantos_write` es `for all using (es_director_de(coro_id))`, y
`es_director_de` incluye a `es_admin()`. Un director puede insertar. Se separa:

```sql
drop policy if exists cantos_write on public.cantos;

create policy cantos_insert on public.cantos
  for insert with check (public.es_admin());

create policy cantos_update on public.cantos
  for update using (public.es_director_de(coro_id))
          with check (public.es_director_de(coro_id));

create policy cantos_delete on public.cantos
  for delete using (public.es_director_de(coro_id));
```

- El admin puede insertar en cualquier coro.
- El director puede actualizar y borrar los de su coro (borrar no se usa: se
  archiva), pero **no insertar**.
- Casos nuevos en `verificar-rls.ts`: el director no inserta; el admin sí; el
  director sigue actualizando.

### 3. Dónde vive

**Configuración** (la pantalla `Más`, que pasa a titularse «Configuración»), caja
**Repertorio**:

- **Cargar una canción** → `/repertorio/nuevo`, solo con `crear_canto`.
- La misma pantalla ofrece las tres entradas: **A mano · Texto · Archivo**.
- El admin elige primero el **coro** (select con los coros que puede ver).

No se toca la ruta de edición ni el resto de Configuración.

### 4. Las tres entradas

**A mano:** el formulario actual (`FormularioCanto`) con el coro elegido. Es el
mismo formulario de hoy, sin `coroActivo` fijo: recibe `coros` y `coroId`.

**Texto pegado / `.txt`:** un `textarea` o un `<input type="file">` que lee el
texto en el navegador (`file.text()`), y el servidor lo convierte con los
motores deterministas. El `.txt` no se sube: se lee localmente y viaja el texto.

**PDF con texto:** se sube a un route handler, se extrae el texto y se descarta.

### 5. Del texto al ChordPro (motor puro)

Nuevo motor `lib/motores/importar-canto.ts`, con test:

```ts
export type CantoImportado = {
  tituloSugerido: string | null
  cifrado: string
  tonalidadSugerida: string | null
  /** Lo que hay que mirar a ojo; nunca se calla. */
  revisar: string | null
}

export function desdeTextoDeCancion(texto: string): CantoImportado
```

Orden de intentos, el mismo que documenta el skill `pdf-a-cantoral`:

1. Si ya es **ChordPro** (`[C]` en línea), se respeta.
2. Si es **acordes sobre la letra**, `desdeElCancionero` (aplica
   `latinaAAmericana`).
3. Si son **dos columnas** (texto extraído con `-layout`), `aAcordesSobreLetra`.
4. Si no se reconoce ningún formato, se devuelve el texto tal cual como letra,
   con `revisar: 'No reconocí acordes; revisá el cifrado antes de guardar.'`

El título sugerido es la primera línea no vacía que no sea un acorde. La
tonalidad sugerida, el primer acorde. **Nunca se completa la letra ni se
inventan acordes.**

### 6. PDF: `pdftotext -layout`, sin librería de PDF

El skill ya probó que `pdftotext -layout` es lo que conserva la alineación que
los motores necesitan. Se usa igual dentro de la app, **por stdin/stdout** (sin
escribir el archivo a disco):

- Route handler `POST /api/cantos/texto` con el archivo en `FormData`.
- `spawn('pdftotext', ['-layout', '-l', '20', '-', '-'])`, con timeout de 10 s y
  el buffer por stdin.
- Si la salida viene vacía o casi vacía → `422` con «Este PDF no tiene texto
  (parece un escaneo). Pasalo por el flujo externo.»
- Dependencia de sistema: **`poppler-utils`** en la imagen de producción
  (Dockerfile) y en la máquina de desarrollo. Se documenta en el README.
- No se usa IA, ni OCR, ni una librería que interprete el PDF por su cuenta.

Los `.txt` y el texto pegado **no** pasan por el route handler: se convierten en
el servidor con el mismo motor, sin subir nada.

### 7. Límites y seguridad

- **Admin-only en tres capas:** la fila de Configuración (`crear_canto`), la
  action (`puede`), y la RLS (`cantos_insert` = `es_admin()`).
- Tamaño máximo del PDF: 8 MB; máximo 20 páginas; timeout 10 s.
- Tipo real: extensión + `Content-Type` + firma `%PDF-`; si no coincide, 400.
- El nombre del archivo no se usa para nada (ni rutas ni logs con el contenido).
- El PDF no se guarda; el texto extraído se devuelve y se descarta.
- La vista previa es obligatoria: no hay «guardar directo» desde el archivo.

### 8. La pantalla y el guardado

1. Elegir coro.
2. Elegir entrada: A mano · Texto · Archivo.
3. Texto/Archivo: el servidor devuelve `CantoImportado`; se llena el
   `FormularioCanto` con `cifrado`, `tituloSugerido` y `tonalidadSugerida`.
4. El admin revisa la vista previa (el mismo motor de lectura), corrige y
   completa momento, autor y fuente.
5. Guardar con `crearCanto({ coroId, ... })`.
6. Si el título ya existe en ese coro, se avisa y **no se pisa**: el admin cambia
   el título o cancela. La comprobación es por `lower(titulo)` en el coro.
7. Al guardar, se entra al canto nuevo.

`crearCanto` cambia su firma para recibir `coroId` y deja de depender de
`sesion.coroActivo`. La RLS decide si el coro es válido (insert de admin).

### 9. Lo que ve el director

- Ya no ve «Cargar un canto nuevo» en Herramientas.
- `/repertorio/nuevo` le responde que crear es del administrador.
- Sigue viendo «Editar» en un canto existente, y sus correcciones de acordes,
  versiones y archivado no cambian.

## Verificación

- Tests puros de `desdeTextoDeCancion`: ChordPro intacto, acordes sobre la letra,
  notación latina, dos columnas, texto sin acordes (con `revisar`), texto vacío.
- Tests de permisos: `crear_canto` solo admin; `editar_canto` como hoy.
- RLS local: el director no inserta un canto; el admin sí; el director actualiza
  uno de su coro.
- Route handler: `.txt`, PDF con texto, PDF escaneado (422), archivo grande
  (413), tipo falso (400), usuario no admin (403).
- `tsc`, `eslint`, `npm test`, `npm run build`.
- Playwright con `admin@cantoral.local` a 360 px: Configuración → Cargar una
  canción → elegir coro → pegar texto → vista previa → guardar → canto visible.
- Con `director@cantoral.local`: no aparece la fila; `/repertorio/nuevo` explica
  el permiso; un canto existente se sigue editando.

## Riesgos y cuidados

- **PDF sin layout:** `pdftotext` sin `-layout` pierde la columna de los acordes.
  Se usa `-layout` siempre; si aun así no se reconoce, la vista previa lo dice.
- **`poppler-utils` en la imagen:** si falta, el import de PDF falla en
  producción. El README y el Dockerfile lo declaran; el route handler devuelve un
  error claro si el binario no está.
- **Título duplicado:** no hay `unique` en la base; la comprobación va en la
  action y el aviso en la UI. Dos admins a la vez podrían crear el mismo título;
  no es destructivo y se corrige editando.
- **Cuerpo grande:** se corta antes de parsear; nunca se confía en el
  `Content-Length` solo.
- **Directores acostumbrados a crear:** el cambio de permiso se explica en la
  pantalla y en el README; su capacidad de editar no cambia.

## Pendiente, fuera de este diseño

- OCR de PDFs escaneados (si algún día se decide).
- Import masivo desde el cancionero (ya existe por fuera de la app).
- Configuración en cajas completa y «Coros de otros lados».
- Multi-coro con look and feel por coro.
- ExtraHosts de producción.
