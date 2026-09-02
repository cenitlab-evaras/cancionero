# Cantoral — PRD del prototipo

**Fecha:** 2026-08-02 · **Estado:** Borrador
**Producto:** Cantoral (nombre de trabajo, ver §18-2) · **Cliente 0:** Coro Misión País
**Repo:** lo define `prd-a-codigo` — no es materia de este documento · **Esquema:** `cantoral` (dedicado, nunca `public`)
**Fuentes:** `docs/` — ver §2 · **Alcance declarado:** un coro católico lee, transpone y toca su repertorio desde el teléfono, y arma con él las celebraciones.
**Backlog vigente:** §19 — once ideas capturadas el 2026-08-06, priorizadas y **sin comprometer**.

---

## 1. Contexto y problema

Un coro parroquial toca con cancioneros en PDF y fotocopias. Eso produce tres problemas concretos,
todos observables en las fuentes de `docs/`:

- **No se puede transponer.** El *Cancionero Misionero* trae *Abre tu jardín* en MI. Si la voz no
  llega, alguien reescribe los acordes a mano en el margen y esa versión solo existe en su copia.
- **No hay repertorio compartido.** Cada músico llega con su propio PDF, en su propia versión, y
  la corrección que hizo uno no le llega a los demás.
- **Armar la misa es memoria y WhatsApp.** El repertorio está organizado por momento litúrgico
  —Entrada, Perdón, Gloria, Ofertorio, Santo, Comunión…— pero no hay dónde dejar escrito *qué se
  canta el domingo* y en qué orden.

Existe un antecedente: **OpenChord**, aplicación libre de cifrados cuyo funcional está en
`docs/FUNCIONAL.md`. De ahí se hereda todo lo que se refiere a **leer y tocar** —renderizar
ChordPro, transponer, auto scroll, diagramas de acordes— porque son problemas ya resueltos y
verificados.

**Qué se arrastra y no se quiere llevar**, y por qué esto es un producto nuevo y no un port:

| Lo que OpenChord es | Por qué no sirve acá |
| --- | --- |
| Sin cuentas, sin servidor, base embebida en el teléfono | El problema central es *compartir* el repertorio del coro. Sin usuarios no hay coro |
| Intercambio por archivo `.openchord` | Mandarse archivos por WhatsApp es exactamente el problema que hay que resolver |
| Listas de reproducción genéricas | El coro no arma "playlists": arma **misas**, con un canto por momento litúrgico |
| Búsqueda en un servicio externo de cifrados (en estado BETA, solo Android) | El repertorio del coro no está en ese servicio: está en dos cancioneros que ya tenemos |
| Inglés y portugués | El coro es chileno |

El resultado que se busca: **que un músico del coro entre desde su teléfono, encuentre el canto de
la Comunión del domingo ya transpuesto a su tonalidad, y lo toque con la pantalla desplazándose
sola.**

---

## 2. Inventario de fuentes

| Fuente | Qué aporta | Manda sobre | Verificable | Cuidado |
| --- | --- | --- | --- | --- |
| `docs/FUNCIONAL.md` | RF-17 a RF-24 (lectura asistida), RN-13 (ciclo de octava), RN-14 (tamaño 14–24), RN-15 (preferencia por canción sobre la global), RN-16 (acordes dentro de comentarios), formato interno ChordPro | las reglas de lectura y el formato de almacenamiento | sí — declara tests existentes de transformación y formateo | Describe una app **sin cuentas y sin servidor**. Su §2 (actores), §6 (modelo de datos) y §7 (persistencia local) **no mandan acá**; se reemplazan por §7 y §8 de este PRD |
| `docs/cancioneros catolicos/Cancionero Catolico.pdf` | *Cancionero Misionero — Coro Misión País 2025*: 99 pág, **91 cantos numerados**, **11 momentos litúrgicos** (índice pág. 3–4) | el contenido de la semilla y el catálogo de momentos | sí, canto por canto contra su página | El nombre del archivo **no es el título real** del documento. Está en **notación latina** (MI, fa#m, SI7) y en **dos columnas** (letra izquierda / acordes derecha): la transcripción a ChordPro es manual, no automática. Trae "Prohibida su reproducción para usos comerciales" (§18-1) |
| `docs/cancioneros catolicos/Cancionero Canto Católico.pdf` | *Canto Católico 2015*: 413 pág, ~380 cantos, mismos momentos litúrgicos y varios títulos en común | reserva de repertorio; confirma que el catálogo de momentos no es idiosincrásico de un solo cancionero | sí | **No se siembra** en el prototipo. Comparte títulos con el Misionero pero **con acordes distintos**: si algún día se ingesta, dos cantos con el mismo título no son duplicados |
| `docs/diseno/ref-ug-chords-oscuro.png`, `ref-ug-modal-acorde.png`, `ref-ug-chords-diagramas.png`, `ref-ug-tab-pro.png` | tema oscuro, acorde en color cálido sobre monoespaciado, barra inferior de auto scroll con velocidad, modal de diagrama de acorde | los tokens y la densidad de la vista de lectura (§11) | no | Son capturas de un producto ajeno: se copia el **patrón de interacción**, no la marca, ni el color exacto, ni la tipografía propietaria |
| `docs/diseno/openchord-original-cinco-pantallas.png` | la estructura de navegación del antecedente | nada — queda superada por la piel oscura y por el cambio de dominio | no | Muestra pestañas y funciones fuera de alcance (búsqueda online, artistas como pestaña propia) |
| `docs/diseno/Captura … 20.26.55 / 20.27.02 / 20.27.09.png`, `ref-transpose-autoscroll-clasico.png` | lacuerda.net y transpositores clásicos: contexto de densidad y de qué espera un músico hispanohablante | nada | no | Baja resolución, ilegibles en detalle. Sirven de referencia de densidad, no de especificación |

**Orden de arbitraje:** cancionero impreso > `FUNCIONAL.md` > capturas de diseño. Si el PDF y el
funcional discrepan sobre un canto, manda el PDF: es lo que el coro tiene en las manos.

### 2.1 Lo que falta

No falta ninguna **fuente**. Faltan dos **datos**:

| Falta | Quién lo tiene | Qué bloquea |
| --- | --- | --- |
| Contraseñas de los tres usuarios de prueba (no van al repo) | el dueño, al sembrar | la verificación de H1 |
| Nombre definitivo del producto | el dueño | nada — se construye con el nombre de trabajo (§18-2) |

---

## 3. Alcance del prototipo

**Entra completo**

- Entrar con cuenta real (correo y contraseña), con portón de aprobación.
- Pertenencia a uno o más coros, con rol por coro.
- Repertorio del coro, clasificado por momento litúrgico.
- Vista de lectura: cifrado renderizado en el servidor, acordes sobre la sílaba.
- Transponer (±semitono, ciclo de octava) y tamaño de letra (14–24, pasos de 2).
- Auto scroll con play/pausa y velocidad.
- Diagramas de acorde de guitarra, coherentes con la transposición vigente.
- Preferencias de lectura por **canto × usuario**.
- Celebraciones: fecha, nombre y un canto asignado por momento, con orden.
- Vista de ejecución de la celebración (recorrer los cantos sin volver al listado).
- Gobierno del coro: el director admite miembros y cambia su rol local.
- Edición del repertorio: el director crea y edita cantos en ChordPro y les asigna momentos.

**Entra solo en lectura** (sembrado, sin pantalla de alta)

- Catálogo de momentos litúrgicos (11 entradas).
- Autores.

**No entra** — ver §16, cada cosa con su razón.

**Tamaño:** 10 tablas · 5 motores puros · 13 rutas · 3 roles · 8 hitos.

### 3.1 Lo que se agregó respecto de las fuentes

| Agregado | Qué cierra | Qué cuesta |
| --- | --- | --- |
| **Momento litúrgico** como clasificación de primera clase | Es como está organizado el cancionero en papel y como piensa el coro. Sin esto, buscar "algo para la Comunión" es imposible | un catálogo global (11 filas) y una tabla de vínculo canto↔momento |
| **Celebración** en lugar de lista de reproducción | Deja escrito qué se canta el domingo y en qué orden; reemplaza al WhatsApp | dos tablas y dos pantallas (armado y ejecución) |
| **Multiusuario con coro como recurso raíz** | Es el problema central: el repertorio es del coro, no de un teléfono | auth, perfiles, vínculo, RLS en toda tabla — es el H1 |

### 3.2 Concesiones de prototipo (declaradas, no descubiertas)

| Concesión | Por qué es aceptable acá |
| --- | --- |
| El repertorio entra por **semilla curada**, no por importador | Cada canto declara PDF y número de canto; el seed es idempotente y tiene su borrador (§13) |
| **Lectura antes que edición**: H1–H6 viven de datos sembrados | Todo lo que se ve en pantalla lo calculó el motor real, no un valor de relleno |
| **Sin borrado** (salvo quitar un canto de una celebración) | Con repertorio compartido, borrar es destructivo para terceros. Va al YAGNI con su razón (§16) |
| **Sin integración continua**; el despliegue lo dispara una persona | El comando exacto está en §15, paso 8 |
| **Sin librería de componentes**: interfaz a mano sobre tokens | Ningún color escrito a mano fuera de los tokens de §11 |
| **Diagramas dibujados en el servidor como SVG**, sin librería de gráficos | El JSON de digitaciones es un dato, no una dependencia de render |
| **Sin IA** | Ni carpeta ni clave de modelo en el ejemplo de entorno, para que nadie crea que existe |

---

## 4. Decisiones de diseño

1. **El coro es el recurso raíz de la autorización**, no el usuario ni la parroquia. El repertorio
   se comparte entre los miembros; con `auth.uid()` como clave de alcance, el director no vería lo
   que no cargó él y dos músicos del mismo coro no podrían trabajar sobre lo mismo. *Consecuencia:*
   toda tabla del dominio lleva `coro_id`, y una persona en dos coros necesita un **coro activo**
   (§18-3).

2. **La celebración reemplaza a la lista de reproducción genérica** (RF-09 a RF-12 del funcional).
   En el dominio real la lista *es* una misa: tiene fecha y un canto por momento, no un orden
   arbitrario. *Consecuencia:* no hay listas libres. Quien quiera una arma una celebración sin
   fecha; si eso resulta forzado, se revisa (§18-6).

3. **El cifrado se almacena en ChordPro y se muestra en notación americana** (C, Am, F#m), como el
   funcional. Los diagramas de guitarra y las librerías de cifrado hablan americana; mostrar
   notación latina agregaría un motor de mapeo que no cierra nada del alcance elegido.
   *Consecuencia asumida:* el músico que viene del cancionero impreso lee `Bm` donde el papel dice
   `sim`. Es fricción real y se acepta a cambio de un motor menos (§18-7).

4. **El cifrado se renderiza en el servidor**, no en un WebView ni con una librería de cliente
   —que es como lo hacía el antecedente—. El posicionamiento de acordes queda como **función pura
   testeable**, y la página llega pintada al teléfono, que es donde la conexión es peor.

5. **Un canto pertenece a un coro**, no es catálogo global. Dos coros tienen versiones distintas
   del mismo canto —tonalidad, estrofas, arreglo— y eso es lo normal, no un duplicado a evitar.
   *Consecuencia:* la semilla se carga por coro, y no existe "el canto oficial" del sistema.

6. **Momentos litúrgicos y autores sí son catálogo global de la instalación** (clase D). Al no
   haber organizaciones, un catálogo global es del producto entero: si mañana entra otro coro con
   otra nomenclatura de momentos, la comparte. Se acepta porque los momentos de la misa son los
   mismos en los dos cancioneros de `docs/`, que es toda la evidencia disponible.

7. **Sin borrado en el prototipo**, salvo quitar un canto de una celebración. El borrado en cascada
   del funcional (RN-05: el artista sin canciones desaparece; RN-06: borrar artista borra sus
   canciones) tenía sentido en un teléfono de un solo dueño; con repertorio compartido, es
   destructivo para terceros. Queda **sin decidir a propósito**, declarado en §16.

8. **Tema oscuro único, sin conmutador claro.** La vista de lectura se usa tocando, casi siempre
   con poca luz, y un conmutador duplica el trabajo de tokens sin cerrar nada.

9. **Despliegue en Vercel, con Supabase gestionado como base.** El cifrado se renderiza en el
   servidor (decisión 4) y las escrituras son server actions, así que el destino tiene que ejecutar
   código de servidor, no ser hosting estático. *Consecuencia:* las variables viven en el proyecto
   de Vercel y **la clave de servicio de Supabase existe solo como variable de servidor** — nunca
   con prefijo público, nunca en el repo. Sin integración continua: el despliegue lo dispara una
   persona con el comando de §15, paso 8.

10. **La transposición no se persiste sobre el cifrado.** Se guarda el número de semitonos en la
    preferencia del usuario y el motor la aplica en cada render. Persistir el cifrado transpuesto
    sería un valor derivado con dos verdades del mismo número.

---

## 5. Modelo de dominio y vocabulario

Los nombres de esta sección son los nombres del código. No hay sinónimos.

```
coro 1 ──< coro_acceso >── 1 perfil            (una persona en varios coros, con rol por coro)

coro 1 ──< canto >── 1 autor                   (el autor es catálogo global)
         canto N ──< canto_momento >── N momento_liturgico

coro 1 ──< celebracion 1 ──< celebracion_canto >── canto
                              cada fila: un momento, un canto, un orden

perfil 1 ──< preferencia_lectura >── 1 canto   (transposición y tamaño, privadas)
```

| Término | Qué es | Qué **no** es |
| --- | --- | --- |
| **canto** | la pieza del repertorio de un coro: título, autor, cifrado | no es "canción" (el funcional decía `Song`; acá se dice canto) |
| **cifrado** | el contenido ChordPro del canto | no es el canto: un canto tiene un cifrado, no *es* su cifrado |
| **momento** | categoría litúrgica: Entrada, Perdón, Gloria, Salmo, Antífona, Ofertorio, Santo, Cordero, Comunión, María, Himno | no es el orden dentro de la misa (dos cantos pueden compartir momento) |
| **orden** | posición del canto dentro de una celebración | no es el momento |
| **celebración** | una misa con fecha y nombre | no es una lista de reproducción libre |
| **rol** | el rol **global** en `perfiles`: `admin`, `miembro`, `externo` | no es el rol dentro de un coro |
| **rol_local** | el rol **en un coro**, en `coro_acceso`: `director`, `musico` | no es el rol global |
| **autor** | quién compuso el canto | no es "artista" (el funcional lo llamaba así); en el cancionero muchos son anónimos o comunitarios |
| **transposición** | número de semitonos, entero de −11 a +11 | no es la tonalidad; el cifrado guardado nunca cambia (decisión 10) |
| **estado** | en qué punto está un canto dentro del coro: `en_ensayo` (se está sacando) o `listo` (el coro lo canta) — H10 | no es el momento litúrgico; y no es una sugerencia: proponer un canto es de una persona, el estado es del canto |

---

## 6. Arquitectura

```
docs/*.pdf ──► transcripción manual a ChordPro ──► seed.sql ──► Supabase (esquema cantoral, RLS activa)
                                                                        │
                          consulta de servidor (cliente de servidor, sesión del usuario)
                                                                        ▼
                                                            motores puros (sin base, sin red, sin reloj)
                                                       transponer · renderizarCifrado · acordesDeCanto
                                                             buscarDigitacion · permisos
                                                                        ▼
                                              componente de servidor de Next.js ──► HTML pintado
                                                                        ▼
                                        isla de cliente mínima: auto scroll, modal de acorde, controles
                                                                        ▼
                                                                     Vercel
```

Escrituras: **server action → valida rol con `permisos` → escribe con la sesión del usuario → la RLS
vuelve a decidir.** La validación previa no reemplaza a la RLS; existe para que el usuario reciba un
mensaje en vez de un guardado que afectó cero filas.

**Dónde vive la lógica pura:** todo lo del bloque de motores. Ninguno importa el cliente de Supabase,
ninguno llama a la red, ninguno lee el reloj — el "ahora" entra como parámetro. Es lo que hace que
cada número de §9 se pueda defender con un test.

**La clave de servicio** solo se usa en el seed y en tareas de servidor; nunca en una ruta que
responda a un usuario.

---

## 7. Modelo de datos

No es el DDL: es qué existe, qué cuelga de qué y quién puede verlo. Las clases (A–E) son las del
patrón de autorización multiusuario; ver §8.

| Familia | Tablas | Clase | Notas |
| --- | --- | --- | --- |
| Raíz | `coros` | **A** | id, nombre, parroquia (texto libre), created_at. Lectura: `puede_ver_coro(id)`; escritura: `es_admin()` |
| Identidad | `perfiles` | **E** | id = id del usuario autenticado, email, nombre, `rol` (`admin`/`miembro`/`externo`), **`aprobado`** (portón), created_at |
| Identidad | `coro_acceso` | **E** | perfil_id, coro_id, **`rol_local`** (`director`/`musico`), único (perfil_id, coro_id) |
| Repertorio | `cantos` | **B** | **coro_id**, titulo, autor_id, `cifrado` (ChordPro), tonalidad_original, notas, **`estado`** (`en_ensayo`/`listo`, default `listo` — H10), created_at, updated_at |
| Repertorio | `canto_momentos` | **B** | canto_id, momento_id, **coro_id denormalizado** |
| Catálogo | `momentos_liturgicos` | **D** | codigo, nombre, `orden` (posición en la misa). 11 filas, global a la instalación |
| Catálogo | `autores` | **D** | nombre (único). Global a la instalación |
| Celebración | `celebraciones` | **B** | **coro_id**, nombre, fecha (nullable), created_at |
| Celebración | `celebracion_cantos` | **B** | celebracion_id, canto_id, momento_id, `orden`, **coro_id denormalizado** |
| Preferencias | `preferencias_lectura` | **C** | perfil_id, canto_id, **coro_id**, `transposicion` (−11..11), `tamano_letra` (14..24, par), updated_at. Único (perfil_id, canto_id) |

**Denormalización obligatoria.** `canto_momentos` y `celebracion_cantos` cuelgan del coro a **dos
saltos**. Cada una lleva su propio `coro_id`, escrito en el insert, para que la política sea
`puede_ver_coro(coro_id)` y no una subconsulta evaluada fila por fila.

**Qué no se hereda del funcional y por qué**

| Del funcional | Por qué no está |
| --- | --- |
| `GlobalSettings` (registro único de preferencias) | Con usuarios reales las preferencias son por persona: viven en `preferencias_lectura` y en el perfil |
| `Playlist` genérica | Reemplazada por `celebraciones` (decisión 2) |
| `Artist` con borrado automático al quedar sin canciones (RN-05) | `autores` es catálogo global: no se borra solo |
| `mostrar_tablaturas` por canción (RF-20) | Los cancioneros católicos no traen tablatura (§16) |

**Rodeos que impone la RLS, escritos ahora y no descubiertos después**

1. Un usuario obtiene **cero filas** de las `preferencias_lectura` ajenas — incluido el director.
   La vista de lectura parte de los valores por defecto (transposición 0, tamaño 16) cuando no hay
   fila propia; ese vacío es legítimo y no se reporta como error.
2. Un perfil **sin aprobar** obtiene cero filas de todo. La ruta lo detecta antes de consultar y lo
   manda a `/esperando-aprobacion`, en vez de mostrarle un repertorio vacío (§14).
3. Un usuario en cero coros ve el listado de coros vacío. Eso **no** es falta de acceso: es un
   estado legítimo con su propio texto ("todavía no perteneces a ningún coro").

---

## 8. Autorización

**Patrón:** multiusuario sin multi-tenant. La pregunta de cada política no es "¿de qué organización
es esta fila?" sino **"¿tiene este usuario alcance sobre el coro del que cuelga esta fila?"**.

### 8.1 Las tres piezas

1. **`perfiles`** — id igual al del usuario autenticado, `rol` global y `aprobado`. Sin
   auto-registro operativo: un usuario nuevo entra pero no opera hasta que un `admin` lo habilita.
2. **Helpers `SECURITY DEFINER`, todos `stable` y con `search_path` fijo al esquema:** `mi_rol()`,
   `es_admin()` (exige `aprobado`), `es_interno()`, `puede_ver_coro(uuid)`,
   `es_director_de(uuid)`. Sin `security definer` una política sobre `perfiles` que lea `perfiles`
   entra en recursión; sin `search_path` fijo, la función es un vector de escalada.
3. **`coro_acceso`** — el vínculo persona↔coro con su `rol_local`. El rol global dice **qué tipo**
   de cosas puede hacer alguien; el vínculo dice **sobre cuáles**.

**Grants que no se pueden olvidar:** `grant usage on schema cantoral to anon, authenticated` y
`grant execute` sobre los cinco helpers. Sin ellos toda política falla con *permission denied for
function* y parece un problema de RLS. Y el esquema `cantoral` debe quedar expuesto en la Data API.

### 8.2 La matriz

Capacidades en filas, roles en columnas. Sin celdas ambiguas. `director` y `musico` se evalúan
**siempre respecto del coro en cuestión**: un director lo es de su coro, no de todos.

| Capacidad | admin | director (de ese coro) | musico (de ese coro) |
| --- | :-: | :-: | :-: |
| ver el coro | sí | sí | sí |
| ver el repertorio del coro | sí | sí | sí |
| ver una celebración del coro | sí | sí | sí |
| leer un canto (vista de lectura) | sí | sí | sí |
| guardar su propia preferencia de lectura | sí | sí | sí |
| ver la preferencia de otro | **no** | **no** | **no** |
| crear o editar un canto | sí | sí | **no** |
| asignar momentos a un canto | sí | sí | **no** |
| crear o editar una celebración | sí | sí | **no** |
| asignar cantos a una celebración | sí | sí | **no** |
| quitar un canto de una celebración | sí | sí | **no** |
| admitir un miembro al coro / cambiar su `rol_local` | sí | sí | **no** |
| crear un coro | sí | **no** | **no** |
| aprobar un perfil nuevo | sí | **no** | **no** |
| editar el catálogo de momentos o autores | sí | **no** | **no** |

Un usuario **sin vínculo** con el coro: **no** a todo, incluido ver. Un usuario **no aprobado**: no
a todo, sin excepción, cualquiera sea su rol.

### 8.3 Dónde vive la matriz y cómo se arbitra

La matriz se escribe **una vez** como función pura en `permisos.ts` —entrada: rol global, rol local
y capacidad; salida: booleano— con su test co-ubicado. La interfaz la consulta para decidir qué
mostrar; las server actions la consultan para decidir si intentar la escritura.

**Regla de arbitraje: si la interfaz y la RLS discrepan, manda la RLS y la discrepancia es un bug.**
No se "arregla" aflojando la política para que la pantalla funcione.

Y toda escritura valida el rol en el servidor **además** de la RLS: sin esa validación previa, la
RLS rechaza en silencio con cero filas afectadas y el usuario cree que guardó.

### 8.4 Alta de usuarios

Registro con correo y contraseña → se crea el perfil con `rol = 'miembro'` y `aprobado = false` →
el usuario ve `/esperando-aprobacion` → un `admin` lo aprueba → un `director` lo vincula a su coro
con `rol_local`. Hasta que ocurren las dos cosas, el usuario está autenticado pero no ve nada.

---

## 9. Motores de cálculo

Todos son funciones puras: sin base, sin red, sin reloj —el "ahora" entra como parámetro— y con su
test co-ubicado. La columna de invariante es lo que convierte "el cálculo está bien" en algo que se
puede probar.

| Motor | Entrada | Salida | Invariante que el test afirma | Archivos |
| --- | --- | --- | --- | --- |
| `transponer` | cifrado ChordPro + semitonos (−11..11) | ChordPro transpuesto | `[Am] [F] [C] [G]` con +2 → `[Bm] [G] [D] [A]`. Con +12 devuelve el original **carácter por carácter**. Un acorde dentro de `{comment: ...}` también se transpone (RN-16). `[F#m]` con +1 → `[Gm]`, y con −1 → `[Fm]` | `motores/transponer.ts` · `.test.ts` |
| `renderizarCifrado` | cifrado ChordPro (+ ancho opcional) | líneas, cada una con sus pares (acorde, columna) y su texto | `U[C]sing the [Dm]chordPro format[G]` produce tres acordes: `C` en columna **1** —el corchete va tras la "U"—, `Dm` en la 10 y `G` en la 25 (final de línea), sobre el texto `Using the chordPro format`, de 25 caracteres. Con `ancho: 20`, ninguna línea supera 20 columnas y cada acorde viaja al trozo que le toca (RF-17) | `motores/renderizar-cifrado.ts` · `.test.ts` |
| `acordesDeCanto` *(construido en H5)* | cifrado ChordPro | lista ordenada, sin repetidos | El cifrado sembrado de *Abre tu jardín* devuelve exactamente `[E, F#m, G#m, B, B7, A]`: seis acordes, en orden de primera aparición, sin duplicados (el cifrado repite `E` y `F#m` varias veces). El test lee el cifrado **real de la semilla**, no una copia | `motores/acordes-de-canto.ts` · `.test.ts` |
| `buscarDigitacion` *(construido en H5)* | nombre de acorde + catálogo de digitaciones | posiciones de traste y cuerdas al aire, o `null` | `C` devuelve `x32010` como primera digitación. Un acorde inexistente (`H9`) devuelve `null`, no lanza. Un acorde **con bajo** también devuelve `null`, por decisión declarada en §17.1-bis. La ventana del diagrama (`trasteInicial`) se **deriva**, no se declara: `G#m` (`466444`) arranca en el traste 4 | `motores/buscar-digitacion.ts` · `.test.ts` · catálogo en `motores/digitaciones.ts` |
| `celebracion` *(agregado en H6)* | los cantos ya asignados + el momento del nuevo · o la lista + el canto actual | dónde se inserta · la renumeración · el recorrido | Agregar un canto de **Entrada** a una misa que ya tiene Ofertorio y Santo lo pone **primero**, no al final; con el mismo momento va después de los que ya están. `reordenar` renumera desde 0 sin huecos ni repetidos (el índice único de la migración no admite empates). `recorrido` usa el **orden guardado**, no el del array: en el primero no hay anterior, en el último no hay siguiente, y un canto ajeno a la celebración no inventa vecinos | `motores/celebracion.ts` · `.test.ts` |
| `autoscroll` *(agregado en H4)* | resto acumulado + píxeles por segundo + milisegundos del cuadro | píxeles a desplazar y el nuevo resto | A 10 px/s, dos cuadros de 50 ms avanzan 0 y luego 1 px: la fracción se acumula, no se pierde (sin esto el scroll va a tirones). 60 cuadros a 24 px/s suman exactamente 24 px. Un cuadro de 30 s se topa para que volver a la pestaña no dispare la página | `motores/autoscroll.ts` · `.test.ts` |
| `permisos` | rol global + rol local + capacidad | booleano | Un `musico` no puede `editar_canto` en ningún caso. Un `director` puede `editar_canto` **solo** con vínculo al coro; sin vínculo, `false`. Un `admin` puede todo salvo `ver_preferencia_ajena`, que es `false` para los tres roles | `permisos.ts` · `permisos.test.ts` |
| `coincideBusqueda` *(agregado al construir H1)* | canto (título + autor) + término | booleano | `"jardin"` encuentra *Abre tu jardín* pese al acento; `"MARÍA"` encuentra por autor ignorando mayúsculas y acento; `"nino"` **no** encuentra *Niño* —la ñ no es una n acentuada—; un término vacío coincide con todo y no filtra nada | `motores/busqueda.ts` · `.test.ts` |

**Composición que hay que respetar:** los diagramas de H5 se calculan sobre el cifrado **ya
transpuesto** —`acordesDeCanto(transponer(cifrado, n))`—, nunca sobre el original. Si no, con +2
semitonos la pantalla muestra `Bm` y el diagrama dibuja `Am`.

---

## 10. Capa de inteligencia

**No hay IA en el alcance.** Ni carpeta, ni cliente de modelo, ni clave en el ejemplo de entorno
—ver §16—, para que nadie asuma que existe una integración a medio hacer.

Si algún día entra, la regla ya está fijada: **los motores deterministas calculan; la IA interpreta,
alerta o redacta sobre lo ya calculado.** Ninguna salida de modelo es fuente de verdad de un acorde
ni de una transposición.

**El backlog de §19 respeta esta regla y no la pone a prueba todavía.** Lo que ahí se llama
"recomendación" —§19-B1— es un motor determinista que cuenta fechas y ordena: *"hace ocho meses que
no cantan este"*, *"lo repitieron cuatro domingos seguidos"*. No hay modelo. Las dos entradas que
usan la palabra "agente" (§19-B4 y §19-B11) serían el primer caso que sí tensiona el veto, y por eso
§18-10 exige definir antes qué significa: un proceso automático determinista no lo toca; emparejar
por parecido semántico, sí.

---

## 11. Diseño e interfaz

**Herencia:** no se hereda la piel de OpenChord. Manda el patrón oscuro de las referencias
`docs/diseno/ref-ug-*.png`. **Superficie que manda:** la **vista de lectura** — es la pantalla que
se usa tocando, con una mano, con poca luz; el resto de la aplicación se pule después.

### 11.1 Tokens

Ningún color escrito a mano fuera de esta tabla.

| Token | Valor | Uso |
| --- | --- | --- |
| `--fondo` | `#0F0F0F` | fondo de la aplicación |
| `--superficie` | `#1A1A1A` | tarjetas, barras, modales |
| `--superficie-alta` | `#242424` | elemento activo, fila seleccionada |
| `--borde` | `#2A2A2A` | separadores |
| `--texto` | `#E8E8E8` | letra del canto y texto principal |
| `--texto-tenue` | `#9A9A9A` | metadatos, autor, subtítulos |
| `--acorde` | `#E08A3C` | **el acorde**, único color cálido de la lectura |
| `--acento` | `#3B82F6` | acciones primarias, foco |
| `--peligro` | `#DC2626` | quitar de celebración, única acción destructiva |
| `--exito` | `#16A34A` | confirmaciones |

| Token | Valor |
| --- | --- |
| `--fuente-cifrado` | `ui-monospace, "SF Mono", "Cascadia Mono", monospace` |
| `--fuente-interfaz` | `system-ui, -apple-system, "Segoe UI", sans-serif` |
| `--tamano-cifrado` | variable 14–24 px, paso 2 (RN-14), por defecto 16 |
| `--interlineado-cifrado` | 1.9 — tiene que caber la línea de acordes sobre la de letra |
| `--espaciado` | escala 4 · 8 · 12 · 16 · 24 · 32 |
| `--radio` | 8 px |

### 11.2 Densidad y tono por superficie

| Superficie | Densidad | Tono |
| --- | --- | --- |
| Vista de lectura | máxima: sin cabecera fija, controles en barra inferior retráctil | el canto ocupa la pantalla; todo lo demás desaparece |
| Repertorio y celebraciones | media: filas de 56 px, agrupadas por momento | escaneable de un vistazo, con el dedo |
| Gestión (miembros, edición) | aireada: formularios de una columna | poco frecuente, se prioriza claridad sobre densidad |

**Objetivo táctil mínimo 44 px** en todo control de la vista de lectura: se usa con la guitarra
puesta.

### 11.3 Estados vacíos

Cada uno con su motivo explícito; ninguno es una pantalla en blanco. Catálogo completo en §14.

---

## 12. Rutas y pantallas

| Ruta | Propósito | Rol mínimo | Edita | Hito |
| --- | --- | --- | --- | --- |
| `/entrar` | correo y contraseña, registro | público | no | H1 |
| `/esperando-aprobacion` | perfil creado, sin aprobar | autenticado | no | H1 |
| `/` | redirige al coro activo, o a `/coros` si hay más de uno | miembro aprobado | no | H1 |
| `/coros` | elegir coro activo | miembro aprobado | no (fija sesión) | H1 |
| `/repertorio` | cantos del coro agrupados por momento, con búsqueda por título y autor (RF-02) | musico | no | H1 |
| `/repertorio/[cantoId]` | **vista de lectura**: cifrado, transponer, tamaño, auto scroll, diagramas | musico | su preferencia | H2–H5 |
| `/repertorio/nuevo` | alta de canto en ChordPro | director | sí | H8 |
| `/repertorio/[cantoId]/editar` | edición de canto y sus momentos | director | sí | H8 |
| `/celebraciones` | celebraciones del coro, por fecha descendente | musico | no | H6 |
| `/celebraciones/nueva` | crear celebración | director | sí | H6 |
| `/celebraciones/[id]` | **vista de ejecución**: recorrer los cantos en orden | musico | no | H6 |
| `/celebraciones/[id]/editar` | asignar canto por momento y ordenar | director | sí | H6 |
| `/coro/miembros` | admitir miembros, cambiar `rol_local` | director | sí | H7 |
| `/admin/perfiles` | aprobar perfiles, crear coros | admin | sí | H7 |

---

## 13. Datos semilla

**Fuente única:** `docs/cancioneros catolicos/Cancionero Catolico.pdf` (*Cancionero Misionero — Coro
Misión País 2025*). Cada canto sembrado declara en el seed **archivo · número de canto · página**.

### 13.1 Catálogo de momentos (11 filas, del índice, pág. 3–4)

| orden | codigo | nombre | pág. de sección |
| :-: | --- | --- | :-: |
| 1 | `entrada` | Entrada | 5 |
| 2 | `perdon` | Perdón | 12 |
| 3 | `gloria` | Gloria | 16 |
| 4 | `salmo` | Salmos | 20 |
| 5 | `antifona` | Antífonas | 27 |
| 6 | `ofertorio` | Ofertorio | 33 |
| 7 | `santo` | Santo | 40 |
| 8 | `cordero` | Cordero | 43 |
| 9 | `comunion` | Comunión | 46 |
| 10 | `maria` | María | 73 |
| 11 | `himno` | Himnos | 83 |

**Assert del catálogo:** el PDF numera 91 cantos y las once secciones suman
7+6+3+6+11+8+4+4+26+11+5 = **91**. Si el seed no cuadra con esa suma, falla.

### 13.2 Cantos (30 del Misionero, uno por lo menos de cada momento)

| Momento | Cantos (n.º del PDF) |
| --- | --- |
| Entrada | 1 Abre tu jardín · 2 Celebremos · 4 Juntos como hermanos · 5 Vamos al encuentro con Cristo |
| Perdón | 8 Hoy perdóname · 12 Señor, ten piedad |
| Gloria | 14 Gloria Palazón · 16 Gloria Nortino |
| Salmo | 18 Salmo 23 · 20 Salmo 104 |
| Antífona | 24 Aleluya II · 27 Donde hay amor · 33 Tu palabra me da vida |
| Ofertorio | 34 El Alfarero · 36 Los cinco panes · 41 Juntos nos acercamos |
| Santo | 42 Santo Español · 43 Santo Gen Rosso |
| Cordero | 47 Cordero de Dios I · 48 Cordero chileno |
| Comunión | 51 Alma de Cristo · 54 Camino, Verdad y Vida · 63 Mar Adentro · 66 Nada te turbe · 67 Pescador de hombres · 71 Te alabo en verdad |
| María | 77 Alégrate María · 83 Reina del Cielo · 85 Venid y vamos todos |
| Himno | 89 Himno Misión País |

**Total: 30 cantos.** Cada uno se transcribe de dos columnas y notación latina a ChordPro con
notación americana (`MI`→`E`, `fa#m`→`F#m`, `SIb`→`Bb`, `SI7`→`B7`, `rem`→`Dm`, `sim`→`Bm`…). El
mapeo se hace **a mano y se revisa contra la página**: no hay parser (§16).

*Ejemplo de trazabilidad, canto n.º 1, pág. 6:* letra "Abre tu jardín, / traigo una nueva noticia"
con acordes `MI fa#m` → `[E]Abre tu jardín, / [F#m]traigo una nueva noticia`. Acordes del canto:
`E, F#m, G#m, B, B7, A` — que es la invariante de `acordesDeCanto` en §9.

### 13.3 Coros y usuarios

| Qué | Detalle | Para qué |
| --- | --- | --- |
| Coro **Misión País** | los 30 cantos | el coro real |
| Coro **San Ejemplo** (control) | 1 canto, distinto de los 30 | probar el aislamiento: nadie de un coro ve el otro |
| Perfil `admin@…` | rol `admin`, aprobado | aprobar perfiles, crear coros |
| Perfil `director@…` | rol `miembro`, aprobado, `rol_local = director` en Misión País | gobierno y edición |
| Perfil `musico@…` | rol `miembro`, aprobado, `rol_local = musico` en Misión País | lectura |
| Perfil `pendiente@…` | rol `miembro`, **no aprobado**, sin coro | probar el portón |
| Perfil `ajeno@…` | rol `miembro`, aprobado, `rol_local = musico` en San Ejemplo | probar el aislamiento entre coros |

### 13.4 Reglas del seed

1. **Idempotente:** correrlo dos veces no duplica nada (por clave natural: código de momento,
   título+coro del canto, correo del perfil).
2. **Cabecera que declara la fuente** de cada bloque: archivo, número de canto y página.
3. **Asserts que fallan**, no que avisan: 11 momentos · 30 cantos en Misión País · 1 en San Ejemplo
   · todo canto con al menos un momento · todo cifrado con al menos un acorde.
4. **Contraparte que borra:** un script que deja el esquema como estaba, para poder volver.
5. **Las contraseñas de prueba no van en el repo.** Se pasan por variable de entorno al sembrar.

---

## 14. Manejo de errores y estados vacíos

**La regla que evita el bug fantasma: cero filas por RLS no es un estado vacío.** Es falta de acceso
y se dice con esas palabras. Toda ruta con alcance verifica el vínculo antes de consultar.

| Situación | Qué se muestra | Por qué no es lo otro |
| --- | --- | --- |
| Perfil sin aprobar | "Tu cuenta está creada y espera aprobación" + a quién avisar | Sin esto vería toda la app vacía y reportaría un bug inexistente |
| Usuario sin ningún coro | "Todavía no perteneces a ningún coro. Pídele a tu director que te agregue" | Vacío legítimo, no falta de acceso |
| Usuario entra a un coro ajeno por URL | "No tienes acceso a este coro" (403), no un listado vacío | Es exactamente el caso que la RLS devuelve como cero filas |
| Coro sin cantos | "Este coro todavía no tiene repertorio" + si es director, botón de agregar | Vacío legítimo |
| Momento sin cantos en `/repertorio` | el grupo no se dibuja | Ruido innecesario |
| Búsqueda sin resultados | "Ningún canto coincide con «X»" + limpiar búsqueda | Distinto de repertorio vacío |
| Canto sin preferencia guardada | se abre en 0 semitonos y tamaño 16, sin mensaje | Es el caso normal la primera vez |
| Canto cuyo cifrado no tiene acordes | se muestra la letra; la barra de diagramas dice "este canto no tiene acordes escritos" | Distinto de un fallo del motor |
| Acorde sin digitación conocida | el diagrama muestra "sin digitación para «X»" y el resto de la barra funciona | `buscarDigitacion` devuelve `null`, no lanza (§9) |
| Celebración sin cantos asignados | "Esta celebración todavía no tiene cantos" + si es director, botón de armar | Vacío legítimo |
| Escritura rechazada por rol | mensaje explícito "no tienes permiso para editar el repertorio de este coro" | La server action valida antes; sin eso, la RLS afecta cero filas y el usuario cree que guardó |
| Fallo de la base | "No pudimos cargar el repertorio. Reintenta" + reintentar | Un error de infraestructura no se disfraza de vacío |

---

## 15. Verificación

Pasos numerados, ejecutables por alguien que no construyó esto.

1. `npm install`, `npm run build` y `npm test` pasan en verde.
2. **Cada invariante de §9 está afirmada por un test con su número:** `Am F C G` +2 → `Bm G D A`;
   +12 devuelve el original carácter por carácter; `C` en columna 1, `Dm` en 10 y `G` en 25;
   *Abre tu jardín* devuelve seis acordes `[E, F#m, G#m, B, B7, A]`; `C` → `x32010`; `H9` → `null`.
3. **La RLS se prueba con dos sesiones reales**, no razonando sobre el SQL: `musico@` ve los 30
   cantos de Misión País; `ajeno@` ve solo el canto de San Ejemplo; `ajeno@` entrando por URL a un
   canto de Misión País recibe "no tienes acceso", no una pantalla vacía.
4. **Cada rol se prueba con un usuario de ese rol** — son tres: `admin@`, `director@`, `musico@`.
   `musico@` no ve el botón de editar **y** la server action de edición lo rechaza con mensaje
   (probar ambas cosas: la interfaz puede ocultar un botón y la acción seguir abierta).
5. **`pendiente@` no pasa el portón:** entra, ve `/esperando-aprobacion` y ninguna otra ruta le
   responde con datos.
6. **Privacidad de las preferencias:** `musico@` transpone un canto +2; `director@` abre el mismo
   canto y lo ve en 0. Sin excepciones para el director.
7. **Se borra la semilla y se recorren todas las rutas de §12:** ninguna revienta, todas degradan
   con el motivo que les corresponde en §14.
8. **Despliegue:** `vercel deploy --prod` desde la raíz del proyecto, con las variables cargadas en
   el proyecto de Vercel. Después: abrir el sitio desplegado, ver el HTML de la vista de lectura
   con `view-source` y **comprobar que no aparece ninguna clave de servicio**; confirmar que la
   única variable con prefijo público es la clave publicable de Supabase.
9. **Prueba de humo con una persona del coro:** alguien que no construyó esto abre una celebración
   sembrada en su teléfono y toca los cinco cantos de una misa sin preguntar nada.

---

## 16. Fuera de alcance (YAGNI)

No es olvido: es decisión, y por eso no se vuelve a discutir cada sesión.

**Ninguna de estas decisiones se revierte en este documento.** Algunas tienen candidato a revisión
en §19; cuando lo tienen, la fila lo dice y nombra qué cambiaría. Mientras tanto, siguen firmes.

| Qué | Por qué no |
| --- | --- |
| Búsqueda online de cifrados (RF-13 a RF-16) | Dependía de un servicio de terceros declarado BETA y solo funcionaba en Android. El repertorio de este coro no está ahí: está en los PDF de `docs/` |
| **Parser de dos columnas** (PDF → ChordPro) | Es el motor más caro del alcance y con 30 cantos curados el prototipo ya se sostiene. Si algún día se ingestan los ~470 cantos, es un hito propio |
| **Notación latina en pantalla** | Decisión 3. Se acepta la fricción a cambio de un motor menos (§18-7) |
| Copia de seguridad e importación `.openchord` (RF-29 a RF-31) | Era el mecanismo de intercambio de una app sin servidor; acá el servidor es el mecanismo |
| Interfaz en inglés y portugués (RF-31) | El producto es en español |
| Page turner táctil (RF-22) | Gesto de pantalla táctil pensado para app nativa; el auto scroll cubre la necesidad |
| Mostrar/ocultar tablaturas (RF-20) | Los cancioneros de `docs/` no traen tablatura |
| Modo proyección | Requiere una segunda superficie de diseño completa; el corte mínimo (§17) no la necesita |
| Listas de reproducción libres | Reemplazadas por celebraciones (decisión 2) |
| Borrado de cantos, autores y coros (RN-05, RN-06) | Con repertorio compartido, borrar es destructivo para terceros. **Sin decidir a propósito**: hace falta antes definir si se archiva, se borra en lógico o se prohíbe. → **Ya tiene candidato de respuesta: §19-B10.** El estado del canto *es* esa definición: se archiva, no se borra. La decisión de no borrar no cambia; deja de estar sin respuesta |
| Sincronización sin conexión / PWA instalable | La vista de lectura llega pintada desde el servidor; medir primero si hace falta |
| Múltiples afinaciones y digitaciones alternativas | Guitarra en afinación estándar, como el antecedente |
| Integración continua | Despliegue a mano, comando documentado en §15 paso 8 |
| **IA en cualquier forma** | Ni carpeta, ni cliente de modelo, ni clave en el ejemplo de entorno |

---

## 17. Hitos

| Hito | Qué entrega | Listo cuando |
| --- | --- | --- |
| **H1 · Entrar y ver el repertorio** ✅ **hecho** (2026-08-02) | Auth real, `perfiles` con `aprobado`, `coros`, `coro_acceso`, helpers y **RLS activa en toda tabla desde la primera migración**; catálogo de momentos; los cantos sembrados; listado agrupado por momento con búsqueda | `musico@` entra y ve 30 cantos agrupados en 11 momentos; `ajeno@` entra y ve 1 canto; `ajeno@` abriendo por URL un canto de Misión País recibe "no tienes acceso"; `pendiente@` no pasa de `/esperando-aprobacion` — **los cuatro verificados en la app**, con la salvedad de la semilla (ver §17.1) |
| **H2 · Leer un canto** ✅ **hecho** (2026-08-02) | Motor `renderizarCifrado` con test + vista de lectura oscura con acordes sobre la sílaba, sobre los tokens de §11 | *Abre tu jardín* en pantalla coincide estrofa por estrofa con la pág. 6 del PDF, con los acordes en `--acorde` sobre la sílaba correcta y sin desbordar en un teléfono de 360 px — **verificado a 360 px, sin scroll horizontal**; la salvedad de "sobre la sílaba" sigue siendo la de §17.1 (la fuente no da la posición) |
| **H3 · Transponer y tamaño** ✅ **hecho** (2026-08-02) | Motor `transponer` con test, controles ± y A↑A↓, `preferencias_lectura` por canto×usuario | Subir 2 semitonos convierte `E` en `F#` en toda la pantalla; al recargar sigue transpuesto; `director@` abre el mismo canto y lo ve en 0; llegar a +12 vuelve a 0 — **los cuatro verificados**: los tres primeros en la app, el ciclo de octava por test (`+12` devuelve el original carácter por carácter) y la privacidad además por `npm run verificar:rls` |
| **H4 · Tocar sin manos** ✅ **hecho** (2026-08-02) | Auto scroll con play/pausa y velocidad continua, en barra inferior | Play desplaza de forma continua, mover la velocidad cambia el ritmo sin saltos, pausa detiene en el punto exacto, y reanudar sigue desde ahí — **los cuatro medidos en la app**: avance parejo (10·20·31·42·53·64 px), 27 px/s en nivel 4 contra 67 px/s en nivel 10, 72 px al pausar y 72 px tras 1,2 s quieto, y 72 → 111 px al reanudar sin salto |
| **H5 · Diagramas de acorde** ✅ **hecho** (2026-08-06) | `acordesDeCanto` + `buscarDigitacion` + catálogo de 48 digitaciones + barra de diagramas SVG dibujados en el servidor | Pulsar un acorde abre la barra centrada en él con los seis acordes del canto; con +2 semitonos los diagramas son los **transpuestos**; un acorde sin digitación muestra su mensaje y no rompe la barra — **los tres verificados en la app a 360 px**: pulsar `G#m` en *Abre tu jardín* abre la tira con `E F#m G#m B B7 A` y esa carta a la vista (con su cejilla y el traste 4); con +2 las cartas pasan a `F# G#m A#m C# C#7 B` **sin cerrarse y sin perder el foco**; y `Bm/A` en *Pescador de hombres* —dato sembrado, sin trucos— dice "sin digitación para «Bm/A»" mientras las otras siete dibujan. Además: la alineación de H2 intacta (`E`→"Abre", `F#m`→"jard**ín**"), sin scroll horizontal, los 7 `<svg>` presentes en el HTML del servidor, y `ajeno@` por URL recibe cero acordes y cero cartas |
| **H6 · Celebraciones** ✅ **hecho** (2026-08-06) | `celebraciones`, `celebracion_cantos` con `coro_id` denormalizado, motor `celebracion` (orden e insercion + recorrido), armado por momento y vista de ejecución | `director@` arma una misa de 5 momentos (Entrada, Perdón, Ofertorio, Santo, Comunión) y `musico@` la recorre en orden desde el teléfono sin volver al listado; el orden que ve es el que se guardó — **verificado en la app**: los cinco cantos se agregaron **en desorden** (Santo, Entrada, Comunión, Perdón, Ofertorio) y el motor los dejó en orden litúrgico; `musico@` recorrió `1 de 5 … 5 de 5` con «Siguiente» sin volver al listado, y en el último el botón dice «Fin de la misa». El orden guardado es `[0,1,2,3,4]`, sin huecos ni repetidos. Lado negativo, las dos capas (§15-4): `musico@` no ve «Armar», por URL recibe "No tienes permiso", y la RLS le rechaza crear, agregar y quitar |
| **H7 · Gobernar el coro** ✅ **hecho** (2026-08-06) | Alta de miembros por el director, cambio de `rol_local`, aprobación de perfiles y creación de coros por el admin; motor `gobierno`; **y la política de `coro_acceso` endurecida para que la base haga cumplir el orden de §8.4** | `musico@` no ve el botón de admitir **y** la server action lo rechaza con mensaje; `director@` agrega a `pendiente@` (ya aprobado por el admin) y este ve el repertorio en su siguiente entrada — **verificado en la app, el recorrido completo**: `pendiente@` quedaba en `/esperando-aprobacion`; `admin@` lo aprobó desde `/admin/perfiles`; recién entonces apareció como disponible en `/coro/miembros` y `director@` lo agregó; al volver a entrar vio **los 12 cantos** de Coro Misión País, sin acceso a Miembros. Las dos capas del lado negativo (§15-4): `musico@` no ve los enlaces, por URL recibe "No tienes permiso", y la RLS le rechaza admitir, aprobar y crear coros |
| **H8 · Editar el repertorio** ✅ **hecho** (2026-08-06) | Alta y edición de cantos en ChordPro **con vista previa en vivo**, asignación de momentos, procedencia opcional, motor `validarCanto` (RN-01) y dos migraciones: el director puede **dar de alta** autores, y el índice único pasa a `(coro_id, titulo, autor)` alineado con RN-03 | `director@` crea un canto nuevo, lo asigna a Comunión y aparece en el listado y en la vista de lectura ya renderizado; guardar sin título o sin cifrado se bloquea con mensaje por campo; `musico@` no puede, ni por interfaz ni por acción directa — **los tres verificados en la app**: se creó *Alma misionera* (Comunión, en D) y quedó renderizada con 8 acordes pulsables y 4 diagramas; guardar vacío devuelve **los dos** errores a la vez, cada uno en su campo y con `aria-invalid`; `musico@` no ve el `+` ni el enlace «Editar», por URL recibe "No tienes permiso", y la RLS le rechaza el insert. Además: dos *Alma misionera* de autores distintos conviven, el mismo título con el mismo autor se bloquea con un mensaje que dice qué hacer, y corregir la posición de un acorde en *El Alfarero* se reflejó en la vista de lectura |

| **H9 · Pegar del cancionero** ✅ **hecho** (2026-08-06) | Motores `latinaAAmericana` y `aChordPro` (+ su composición `desdeElCancionero`), con detección y aviso en el editor | El director pega un canto **tal como está en el cancionero** —acordes en línea aparte y en notación latina— y la app lo convierte a ChordPro americano conservando la columna de cada acorde; un cifrado que ya está en ChordPro pasa intacto; si no se reconoce ningún acorde, el editor lo dice antes de guardar — **verificado con el primer canto que un usuario real cargó** («Escojo la vida»): estaba guardado como texto plano, sin un solo acorde; tras convertir quedó con 121 acordes pulsables, 8 diagramas y transposición funcionando |

| **H10 · Estado del canto** ✅ **hecho** (2026-08-07) | Columna `estado` en `cantos` (`en_ensayo` · `listo`, default `listo`), motor `estadoCanto` con test, selector en el formulario de alta y edición, y la marca en el listado y en la vista de lectura | `director@` pone un canto **en ensayo** desde el formulario y el listado lo muestra **marcado, en su mismo grupo de momento y sin cambiar de lugar**; el resto del repertorio sigue sin marca; el músico ve la marca al abrir el canto, así sabe que se está sacando; y **no puede cambiarla ni por interfaz ni por acción directa** — las dos capas de §15-4. **Los cuatro verificados en la app a 360 px**: se puso *Escojo la vida* en ensayo desde «Editar» y volvió a quedar **segunda dentro de Entrada, el mismo lugar que ocupaba antes** (el listado se capturó antes y después), con la marca «EN ENSAYO» bajo el título y el pie pasando de «13 cantos» a «13 cantos · 1 en ensayo»; **1 de 13 marcado**, el resto intacto; `musico@` ve la marca en el listado y al abrir el canto, no ve el `+` ni «Editar», por URL recibe "No tienes permiso", y la RLS le rechaza el `update` sin política nueva. Además: `scrollWidth` 360 = `clientWidth` 360, sin scroll horizontal; y **ni el director puede escribir `archivado`** — el `check` de la migración lo rechaza |

**Los ocho hitos del PRD están hechos y verificados corriendo la app (2026-08-06), más el
H9 que §18-7 dejaba condicionado a "si estorba". H10 es el primero que sale del backlog de §19.**

### Cómo entró H10, y con qué recorte

Viene de **B10**, la primera del orden propuesto en §19.3. El dueño lo decidió el 2026-08-07 y
eligió el corte mínimo en las cuatro decisiones que §19.2 había dejado abiertas:

| Se preguntó | Se decidió | Consecuencia |
| --- | --- | --- |
| Cuántos estados | **Dos**: `en_ensayo` y `listo` | `archivado` **no entra** — ver abajo |
| Quién los cambia | **Solo el director** | Reusa `editar_canto` y `cantos_write` (`es_director_de`): **cero cambios de RLS**, §8 no se toca |
| Cómo se ve | **Marca por fila**, sin mover el canto de su grupo | No hay "segmento" aparte: el listado sigue agrupado por momento como en H1 |
| Si el armador avisa | **No**, queda para después | El armado de celebración de H6 no se toca |

**El borrado de §16 sigue sin resolverse, y hay que decirlo.** B10 argumentaba que el estado lo
cerraba —*«archivar es un estado más, y borrar deja de hacer falta»*—. Con dos estados eso **no
pasa**: un canto que el coro dejó de cantar no tiene dónde ir, y §16 sigue esperando la decisión
entre archivar, borrado lógico o prohibir. Agregar `archivado` después es una migración de una
línea (el `check` de la columna), no un rediseño.

### 17.1-sexies Lo que quedó pendiente de H10 (declarado, no recortado en silencio)

| Del backlog | Cómo quedó | Por qué / cuándo se revisa |
| --- | --- | --- |
| **`archivado` y el borrado de §16** | **No entra.** Dos estados | Decisión del dueño (arriba). §16 sigue esperando su definición |
| **El estado se cambia solo desde «Editar»** | Abrir el canto → Editar → Estado → Guardar: **cuatro toques** | El estado es del canto y por eso vive donde se edita el canto. Pero se mueve **durante el ensayo**, con la guitarra puesta, que es justo cuando cuatro toques molestan. Si estorba, el atajo natural es un control en la vista de lectura, visible solo para el director — el mismo lugar donde H5 puso los diagramas |
| **La marca no filtra ni ordena** | Se ve la marca y el total al pie; no hay "mostrar solo los que están en ensayo" | Con 13 cantos la lista se escanea de un vistazo. Con los ~470 del cancionero (§16) deja de servir, y ahí el filtro se vuelve el hito, no el adorno |
| **El armador de celebración no avisa** | Se puede meter un canto en ensayo a una misa sin que nada lo diga | Decidido arriba. El dato ya está disponible para cuando se quiera: `celebracion_cantos` llega al canto y el canto trae su estado |
| **La semilla no siembra ningún canto en ensayo** | Los 12 sembrados nacen `listo` | Correcto: son los que el coro canta. La consecuencia es que **la marca no se ve hasta que alguien la pone**, y la verificación de este hito la puso y la volvió a sacar |

**Un arreglo colateral, para que no aparezca como misterio.** El pie del listado decía *«como
director vas a poder agregarlos en el hito 8»* — un texto que quedó mintiendo desde que H8 se
construyó. H10 lo reemplazó por el resumen de estado (`· N en ensayo`).

### Por qué H9 dejó de ser hipotético

§18-7 decía: *«La notación americana puede ser fricción real para músicos formados con el cancionero
impreso. **Medirlo con el coro en H2.** Si estorba, el motor de mapeo latina↔americana es pequeño y
encaja como hito 9.»*

Se midió sin querer y de la peor manera: el **primer canto que un usuario cargó por la app** lo
escribió como está en el cancionero —acordes en una línea aparte, en latina— y se guardó como texto
plano. Sin acordes reconocidos no había color, ni diagramas, ni transposición; y **el editor no
avisó nada**. La fricción no era hipotética y el silencio del editor la volvía invisible.

Se corrigieron las dos cosas: la conversión (H9) y el aviso (el editor ahora dice cuándo no
reconoció ningún acorde, en vez de dejar guardar algo que no va a funcionar).

**Corte mínimo aceptable: H4 — ✅ ALCANZADO el 2026-08-02.** Con entrar, ver, leer, transponer y
auto scroll, el coro ya puede tocar una misa completa con el repertorio sembrado, que es exactamente
el problema de §1. De H5 en adelante es mejora, no habilitación.

Lo que hay hoy, corriendo: **los 8 hitos + H9 + H10** · 12 cantos sembrados con su fuente · 10 tablas
con RLS · 13 motores puros con 180 tests · 24/24 comprobaciones de RLS con sesiones reales (31 con
una celebración armada: las 7 de H6 se omiten solas si no hay ninguna).

**Un hueco que H7 encontró y cerró.** La política `coro_acceso_write` evaluaba solo a *quien
escribe* (`es_director_de(coro_id)`), no al perfil que se estaba vinculando: un director podía
agregar a su coro a alguien todavía sin aprobar, que después no vería nada pero quedaría en la lista
como un miembro fantasma. §8.4 fija el orden —el admin aprueba, después el director vincula— y ahora
lo hace cumplir la base, no solo la server action: `20260806000100_gobierno.sql` le agrega un
`with check` que exige que el perfil esté aprobado y no sea `externo`. Validarlo solo en la action no
alcanzaba porque una action es alcanzable por POST directo (innegociable 2).

**H5 no llevó migración, y es correcto.** No crea ninguna tabla: las digitaciones no son datos del
coro sino una constante del dominio de la guitarra —`C` se toca `x32010` para todos los coros—, y
§3.2 ya había decidido que el JSON de digitaciones es un dato, no una dependencia de render. Sin
tabla no hay nada que una política pudiera decidir. Lo que ocupó el lugar de esa capa en la rebanada
es `lib/motores/digitaciones.test.ts`: recorre los 12 cantos sembrados en las 23 transposiciones y
afirma que ningún acorde queda sin digitación. El día que H8 permita escribir un `Dsus4`, ese test se
pone rojo solo.

### 17.1-quinquies Lo que quedó pendiente de H8, y cómo se hereda el funcional

| Del funcional | Cómo quedó | Por qué |
| --- | --- | --- |
| **RN-01 · título y contenido no vacíos, con mensaje por campo** | Cumplido. `validarCanto` devuelve un mapa campo→mensaje y **todos** los errores a la vez | Uno por vez obliga a guardar dos veces para enterarse de todo |
| **RN-02 · el autor es obligatorio** | **No se hereda.** El autor es opcional | El *Cancionero Misionero* tiene muchos anónimos, `autor_id` es nullable desde H1 y el "listo cuando" de H8 solo exige bloquear título y cifrado |
| **RN-03 · no dos cantos con el mismo título del mismo artista** | Adoptado, reemplazando al índice anterior que era **más estricto** que el funcional | §17.1 declaraba la limitación "hasta que aparezca el caso real de dos versiones". Con el repertorio entrando por la app, apareció |
| **RF-25 · editar en ChordPro** | Cumplido, con vista previa en vivo del mismo motor de la lectura | Posicionar un acorde a ciegas es inviable, y §17.1 ya declaró que se corrige a oído |
| **RF-26 / RF-27 · editar en "acordes sobre letra" y convertir entre formatos** | **No entra** | §17 asigna a H8 solo ChordPro. Sería un motor de conversión bidireccional, un hito propio |
| **RF-28 · gestionar metaetiquetas** | Parcial: `renderizarCifrado` ya ignora `{title:}`, `{artist:}` y compañía, pero el editor no las oculta ni las regenera | Se escriben a mano si alguien las quiere; no estorban |

Otros pendientes de H8:

| Pendiente | Por qué | Cuándo se salda |
| --- | --- | --- |
| **`db:seed` pisa lo que el director cargó por la app** | `sembrar.ts` busca por (coro_id, título, autor) y **actualiza** si lo encuentra. Verificado en vivo: una corrección de acorde hecha en la app se revirtió al resembrar. Con el repertorio entrando por la app, la semilla dejó de ser la única fuente | Antes de la primera carga real: o el seed pasa a insertar-solo-si-falta, o se acepta que es "restaurar al estado de fábrica" y se documenta en el README |
| **Sin borrado de cantos** | Decisión 7 y §16: sigue "sin decidir a propósito". Un canto cargado por error solo se puede corregir, no eliminar | Requiere decidir antes si se archiva, se borra en lógico o se prohíbe |
| **La notación latina sigue sin soportarse** | El PDF está en latina (MI, fa#m, SI7) y quien transcriba traduce de cabeza. §18-7 lo asigna a un "hito 9" | El motor es chico: 12 notas más los sufijos. Se evalúa después de cargar los primeros cantos a mano |
| **El editor no valida que el ChordPro tenga sentido** | Solo exige que no esté vacío (RN-01). Un corchete sin cerrar se guarda y el motor lo tolera sin romper | La previa en vivo hace visible el problema antes de guardar, que es mejor que un error de validación |

### 17.1-quater Lo que quedó pendiente de H7 (declarado, no recortado en silencio)

| Pendiente | Por qué | Cuándo se salda |
| --- | --- | --- |
| **No hay registro de usuario en la app** | §12 lista `/entrar` como "correo y contraseña, **registro**", pero solo se construyó el ingreso. El trigger `crear_perfil_al_registrarse` ya existe y funciona; falta el formulario. Hoy una cuenta nueva se crea desde Supabase Studio o con la semilla | Es un formulario y una llamada a `signUp`. **Bloquea la prueba de humo de §15-9** con alguien del coro: sin registro, el admin tiene que crear cada cuenta a mano |
| **El admin no puede asignar a alguien a un coro que no es el suyo** | `/coro/miembros` trabaja sobre el **coro activo**, y el admin no pertenece a ninguno (§17.1). Puede crear coros, pero para poblarlos tiene que entrar como director de ese coro | Se salda dando al admin un selector de coro en la pantalla de miembros, o dejando que se autoasigne. No lo pedía el "listo cuando" |
| **No se puede quitar a alguien del coro** | Se puede cambiarle el `rol_local`, no desvincularlo. Coherente con la decisión 7 (sin borrado en el prototipo), pero acá el borrado no es destructivo para terceros: solo saca a una persona de una lista | Es un `delete` sobre `coro_acceso` y un botón; conviene decidirlo junto con el resto del borrado (§16) |
| **El aviso de "único director" se calcula en cada carga** | `directores_de()` es una función `stable`, no una columna: es lo correcto (cero derivados persistidos), pero se llama una vez por render de la pantalla | No requiere acción con coros de este tamaño |
| **Suspender una cuenta no la expulsa de sus coros** | Quitar la aprobación la deja sin ver nada —`puede_ver_coro` exige `aprobado`—, pero su fila de `coro_acceso` sigue ahí. Al re-aprobarla vuelve a su coro, que es el comportamiento deseable | No requiere acción; se declara para que no sorprenda |

### 17.1-ter Lo que quedó pendiente de H6, y cómo se hereda el funcional

Al construir H6 se revisó `docs/FUNCIONAL.md` §3.2 (RF-09 a RF-12, listas de reproducción). La
celebración **reemplaza** a la lista genérica (decisión 2), así que no se hereda todo — pero lo que
no se hereda se escribe acá en vez de descubrirse después.

| Del funcional | Cómo quedó en H6 | Por qué |
| --- | --- | --- |
| **RF-09 / RN-07 · el nombre de la lista es obligatorio y ÚNICO** | Obligatorio sí (`check btrim(nombre) <> ''`); **único no** | Dos misas *sí* pueden llamarse "Misa del domingo" en domingos distintos, y es el caso normal. La unicidad tenía sentido en una playlist sin fecha; una celebración tiene fecha, y el par nombre+fecha es lo que la identifica. **Divergencia deliberada del funcional** |
| **RF-10 · añadir y quitar cantos «desde la propia lista o desde la vista de lectura»** | Solo desde el armador (`/celebraciones/[id]/editar`) | La mitad del requisito **no está construida**. §12 no le asigna esa capacidad a la vista de lectura, así que no se adelantó; pero es una capacidad del funcional heredado y no un olvido. Se salda agregando un control a la vista de lectura, si el director lo pide |
| **RF-11 · ordenar por título, por autor o arrastrando** | Orden litúrgico automático + mover ↑↓ una posición | La celebración no es una lista libre (decisión 2): el orden lo propone la liturgia y el director lo ajusta. Ordenar por título no tiene sentido en una misa. **Sin arrastre**: mover de a una posición alcanza para cinco cantos y no pide una librería de drag |
| **RF-12 · compartir la lista como `.openchord`** | No entra | Ya estaba en §16: el servidor es el mecanismo de intercambio |
| **RN-08 · una canción puede pertenecer a varias listas** | Se respeta: el único es `(celebracion_id, canto_id)` | Un canto está en todas las misas que haga falta, una vez en cada una |

Otros pendientes de H6:

| Pendiente | Por qué | Cuándo se salda |
| --- | --- | --- |
| **No hay celebraciones en la semilla** | Se armó una a mano para verificar el hito. Las comprobaciones de H6 en `npm run verificar:rls` se **omiten solas** si no hay ninguna armada, en vez de fallar | Sembrar una misa de ejemplo haría el hito verificable sin pasos manuales; se puede agregar a `sembrar.ts` cuando estorbe |
| **La celebración no se puede renombrar ni borrar** | RF-09 pedía las tres (crear, renombrar, eliminar). Crear está; el borrado va contra la decisión 7 (sin borrado en el prototipo) y renombrar no lo pide §12 | Renombrar es un formulario y una action; el borrado espera la decisión de §16 |
| **El reordenamiento escribe fila por fila, en dos pasadas** | El índice único `(celebracion_id, orden)` no admite empates ni una actualización masiva sin colisión. Con cinco cantos es imperceptible | Si una celebración creciera a decenas, conviene una función `security definer` que renumere en una transacción |

### 17.1-bis Lo que quedó pendiente de H5 (declarado, no recortado en silencio)

| Pendiente | Por qué | Cuándo se salda |
| --- | --- | --- |
| **Los acordes con bajo (`X/Y`) no tienen digitación** y muestran el mensaje de §14 | Afecta a 3 de los 12 cantos (7 acordes: `G/B`, `D/A`, `A9/C#`, `Bm/A`, `D/F#`, `C/G`, `Am/G`). Caer al acorde base sería **peor**: `G/B` resolvería en 0 y `A/C#` no en +2, o sea que el comportamiento cambiaría al transponer. Cubrirlos de verdad son 84 entradas más de dato musical a mano | Se salda con un `if` de caída al acorde base marcado como *aproximado* y dos tests, si algún músico del coro lo reclama |
| **El catálogo tiene 48 entradas: 12 raíces × `""`, `m`, `7`, `m7`** | Son exactamente los sufijos que el repertorio usa sin bajo, y bastan para cubrirlo entero en las 23 transposiciones. `sus4`, `maj7`, `dim` y `aug` no aparecen en ningún cifrado sembrado | Cuando H8 permita escribirlos: el test de cobertura se pone rojo solo y avisa cuál falta |
| **Las 48 digitaciones no fueron revisadas con una guitarra en la mano** | Los tests verifican la **forma** (seis cuerdas, trastes dibujables, cejilla coherente) y la **cobertura**, pero no que cada forma suene bien: un dato musical equivocado pasaría en verde | Revisión a oído por alguien que toque, contra el cancionero. Corregir una entrada es cambiar seis caracteres |
| **El estado "canto sin acordes" se verificó con un `UPDATE` local temporal** | Los 12 cantos sembrados tienen acordes, así que no hay instancia natural del estado de §14 | No requiere acción; si algún día se siembra un canto solo con letra, el caso pasa a ser natural |
| **Sin JavaScript los diagramas se ven, pero la hoja no abre** | El dibujo es del servidor (los `<svg>` están en el HTML); el gesto de abrir es del cliente | No requiere acción: es la división que piden la decisión 4 y §3.2 |

### 17.1 Lo que quedó pendiente de H1 (declarado, no recortado en silencio)

| Pendiente | Por qué | Cuándo se salda |
| --- | --- | --- |
| **La semilla tiene 12 cantos, no 30** | Decisión del dueño al arrancar, siguiendo la recomendación de §18-5: uno por momento litúrgico alcanza para cerrar H1 y para armar una misa completa en H6 | durante H2–H4, ampliando `supabase/seed/cantos.ts` |
| ~~Los acordes van al comienzo de su línea~~ → **posicionados con criterio musical** (2026-08-02) | El cancionero no dice sobre qué sílaba cae cada acorde. Se repartieron sobre la métrica del verso para que el cifrado sirva para tocar. **Qué acordes y en qué orden es dato de la fuente; dónde caen es una estimación**, declarada en la cabecera de `supabase/seed/cantos.ts` | corregir a oído es trabajo esperable: mover un corchete no rompe nada, porque la transposición se calcula al leer |
| **El tamaño de letra es un máximo, no un valor fijo** | En pantalla angosta el ajuste al ancho puede achicar la letra por debajo de lo pedido. Pedir letra más grande reduce las columnas por línea, así que el efecto se nota — pero el número exacto no se respeta al pie | se revisa si algún músico lo reporta como raro |
| **El canto n.º 42 *Santo Español* se reemplazó por el n.º 43 *Santo Gen Rosso*** | El 42 tiene erratas en el PDF de origen (`Sol Le`, `Si Fo` no son acordes). Ambos están en la lista de §13.2 | no requiere acción; si alguien reconstruye el 42, hay que corregirlo a oído |
| **La vista de canto muestra el cifrado en texto plano** | El render con acordes sobre la sílaba es H2 y no se adelanta | H2 |
| **El admin no pertenece a ningún coro** | Crear coros y asignar miembros es H7; hasta entonces el admin ve el vacío legítimo con su motivo | H7 |
| **Un canto por coro no puede repetir título** | Índice único `(coro_id, lower(titulo))`, necesario para que la semilla sea idempotente. Reproduce la limitación RN-03 del funcional heredado dentro de un mismo coro | se revisa si aparece el caso real de dos versiones del mismo canto |

---

## 18. Riesgos y decisiones abiertas

| # | Riesgo / decisión | Recomendación | Confirma | Bloquea |
| --- | --- | --- | --- | --- |
| 1 | El *Cancionero Misionero* declara "Prohibida su reproducción para usos comerciales" | Uso privado del coro, sin publicación abierta ni registro libre; cada canto muestra su fuente en pantalla. Antes de cualquier apertura pública, pedir permiso al Coro Misión País | el dueño | despliegue **público**; ningún hito interno |
| 2 | Nombre del producto sin definir | Nombre de trabajo **Cantoral**; el esquema `cantoral` puede nacer con él y renombrarlo después cuesta una migración de esquema | el dueño | nada |
| 3 | Una persona en varios coros necesita un **coro activo** | Selector en la barra superior; el coro activo vive en la sesión y toda ruta lo respeta. Si el usuario está en un solo coro, se elige solo y el selector no aparece | el dueño | H1 |
| 4 | ¿Enlace público de solo lectura para un canto o una celebración? | No en el prototipo: primero hay que resolver el riesgo 1 | el dueño | nada |
| 5 | Transcribir 30 cantos a ChordPro es trabajo manual medido en horas, no en minutos | Empezar por los 12 que cubren una misa completa (uno por momento) y crecer; el seed declara cuántos hay en cada corrida, así que el número nunca es una sorpresa | el dueño | H1 (con 12 se puede cerrar H1; los 30 pueden completarse durante H2–H4) |
| 6 | La celebración sin fecha como sustituto de una lista libre puede sentirse forzada | Construir H6 como está y evaluarlo con el coro; si estorba, agregar `tipo` a `celebraciones` (`misa` / `ensayo` / `lista`) es una columna, no un rediseño | el dueño, después de H6 | nada |
| 7 | ~~La notación americana puede ser fricción real~~ → **CONFIRMADO y resuelto en H9** (2026-08-06) | Se midió con el primer canto que cargó un usuario real: vino en latina y en formato de cancionero, y se guardó como texto plano sin que nada avisara. Se construyeron los dos motores y el aviso del editor | decidido | nada |
| 8 | El catálogo de momentos es **global a la instalación** (decisión 6): un segundo coro con otra nomenclatura la comparte | Aceptar mientras haya un solo coro real. Si entra un segundo con nomenclatura distinta, el catálogo pasa a colgar del coro — es una columna `coro_id` nullable y un cambio en una política | el dueño | nada, pero se revisa antes de sumar el segundo coro real |
| 9 | Los dos cancioneros comparten títulos con acordes distintos | No deduplicar por título: un canto pertenece a un coro (decisión 5) y las versiones distintas son legítimas | decidido | nada |
| 10 | **Rastrear cancioneros católicos en internet y proponer versiones** (§19-B4) | **No construir todavía.** Choca con cuatro cosas escritas: §16 dos veces (búsqueda online, IA), §18-1 (rastrear terceros *amplía* la superficie legal, no la reduce) y §18-9 (si las versiones distintas son legítimas, lo hallado **no actualiza** un canto: entra como canto aparte). Antes hay que definir qué significa "agente" —proceso determinista o modelo—. **Alternativa barata que cubre buena parte: que el director pegue una URL o un texto a mano** y los motores de H9 (`desdeElCancionero`) conviertan. Sin cron, sin un adaptador por sitio, sin rastreo | el dueño | §19-B4; nada de lo construido |
| 11 | **Datos personales de los miembros** (§19-B5) y **grabaciones de su voz** (§19-B6/B7) | Hasta hoy el único dato de persona es el correo de la cuenta. Edad y sexo suben el nivel, y una grabación de voz identifica a alguien que puede ser menor de edad. Decisión tomada: **se guardan los cuatro campos tal cual** (edad, sexo, tesitura, disponibilidad) **con visibilidad declarada** — el director ve la ficha completa del coro que dirige, el músico no ve datos ajenos. Falta resolver: consentimiento para las grabaciones y qué pasa cuando alguien deja el coro | el dueño | §19-B5, §19-B6, §19-B7 |
| 12 | **El ranking y la recomendación le dan consejos opuestos al director** | El historial dice *"hace ocho meses que no cantan este"*; el ranking dice *"la gente quiere este"* — y la gente quiere siempre los mismos. Uno empuja a rotar, el otro a repetir. No es un defecto: es una decisión de qué se muestra primero al armar la celebración | el dueño, al construir H17 (§19.3) | §19-B9 y §19-B1-C conviviendo |
| 13 | **No hay versionado del cifrado** | Con repertorio compartido, una corrección equivocada es silenciosa e irreversible: no se sabe quién cambió qué ni se puede volver atrás. Hoy no molesta porque solo el director edita, desde una pantalla, a conciencia (H8). Corregir acordes *en el lugar* multiplica las ediciones pequeñas y lo vuelve necesario | el dueño | §19-B8 **no debería construirse sin esto** |
| 14 | **Audio: peso, cuota y el navegador del teléfono** | El repertorio entero en texto pesa menos que un solo canto grabado a cuatro voces: hay que declarar cuota y qué pasa al llenarse. Y grabar desde el navegador móvil tiene a **Safari en iPhone como punto frágil** —soporte y formatos que no coinciden con Android—. Se declara ahora para que no se descubra construyendo | el dueño | §19-B6, §19-B7 |
| 15 | **Pulsar un acorde ya hace algo** | H5 dejó verificado que pulsar un acorde abre la barra de diagramas centrada en él. Editar en el lugar necesita **otro gesto** —modo de edición explícito, pulsación larga, u otra cosa—, no puede colgar del mismo | el dueño | §19-B8 |
| 16 | **Claves de API de terceros** (§19-B11) | §16 dice "ni clave en el ejemplo de entorno", pero esa frase era **sobre IA**. YouTube y Spotify piden clave y no son un modelo. Hay que decidir explícitamente si el veto las alcanza o si era específico de la integración de modelos | el dueño | §19-B11 |

**Cerrado en esta captura (2026-08-06):** el músico **sí escribe**, y escribe **solo filas suyas** —
su inscripción a una celebración, su sugerencia de canto. Nunca repertorio, nunca celebraciones
ajenas, nunca datos de otra persona. Ver §19.5.

---

## 19. Backlog — lo capturado el 2026-08-06

**Qué es esta sección:** once ideas del dueño, ordenadas por costo y dependencia, con lo que cada
una cuesta y contra qué choca.

**Qué NO es:** alcance aprobado. **Nada de acá está comprometido ni tiene fecha.** §17 sigue siendo
el registro de lo hecho y verificado, y es de donde toma `prd-a-codigo`. Una entrada de §19 pasa a
§17 recién cuando se decide construirla y se le escribe su *listo cuando*.

Cada entrada se cita **textual**, como la dijo el dueño, para que la reformulación no le cambie el
sentido en la próxima lectura.

### 19.1 Lo que la captura reveló

Las once ideas no son once funcionalidades sueltas. Son **el ciclo de vida de un canto dentro del
coro**, y estaba incompleto:

```
alguien lo sugiere  →  entra en ensayo  →  se aprende escuchándolo  →  queda listo
     (B9)                  (B10)              (B11 · B6 · B7)            (B10)
                                                                            ↓
   se recomienda   ←   queda en el historial   ←   se canta en la misa
       (B1)                    (B1)                    (H6 · B2)
                                                            ↑
                                             y se corrige a oído (B8)
```

Cantoral tiene construido **solo el tramo de abajo**: armar la celebración y cantarla (H6). Todo lo
capturado es el tramo de arriba — **cómo un canto llega al repertorio**. Por eso las entradas se
enganchan tanto entre sí, y por qué B10 (una columna) desbloquea a casi todas.

**B4 es la única que queda fuera del ciclo**, y es además la más cara y la que choca con más
decisiones escritas. Eso, por sí solo, es una señal de prioridad — ver §18-10.

### 19.2 Las once entradas

| ID | Qué pide | Cuelga de | Costo |
| --- | --- | --- | :---: |
| **B1** | Historial de qué se cantó y recomendación por frecuencia | §3, §9, pantalla | bajo |
| **B2** | Cada músico se inscribe a la misa donde va a cantar | tabla nueva, **§8** | medio |
| **B3** | Modo solo letra: ocultar los acordes | columna + control | **muy bajo** |
| **B4** | Rastrear cancioneros online y proponer versiones | — | **alto** → §18-10 |
| **B5** | Ficha del miembro: edad, sexo, tesitura, disponibilidad | §7, **§8** | bajo |
| **B6** | Subir audio para que el coro aprenda las voces | **infraestructura nueva** | alto |
| **B7** | Cada uno graba su voz y el director las escucha juntas | depende de B6 | alto |
| **B8** | Corregir acordes en el lugar y colapsar repetidos | §9 + **§18-13** | bajo (A) / medio (B, C) |
| **B9** | Ranking de sugerencias por momento | tabla nueva, **§8** | bajo |
| **B10** | Estado del canto: en ensayo / listo | **una columna** | **muy bajo** |
| **B11** | Buscar versiones en YouTube o Spotify | API externa | medio |

---

**B1 · Historial de ejecución y recomendación por frecuencia**

> *"Medir todas las veces que vamos a cantar cada domingo e identificar qué cantos cantamos en cada
> parte de la misa. Para poder medir cuántas veces hemos cantado ese canto, en cuánto tiempo y cómo
> lo hemos repetido a través del tiempo. Para que después nos haga recomendaciones."*

**Cero tablas nuevas.** `celebraciones` tiene fecha y `celebracion_cantos` tiene momento, canto y
orden: **la celebración armada en H6 ya es el historial**. Falta el motor que lo lee y la pantalla.

| Pieza | Qué es |
| --- | --- |
| A · Historial | Consultas sobre lo que H6 ya guarda |
| B · Métricas por canto | Motor puro §9: veces cantado, hace cuánto, con qué espaciado |
| C · Recomendación al armar | Ordenar por recencia y frecuencia. **Determinista, ver §10** |

**Decidido:** el dato sale de la celebración armada. Sin registro retroactivo ni confirmación
post-misa. **Riesgo aceptado:** si el domingo se cambia un canto sobre la marcha y nadie corrige la
celebración, el historial miente. Se acepta a cambio de no crear una tarea semanal para nadie.

---

**B2 · Inscripción de integrantes a la celebración**

> *"Un segmento donde cada integrante del coro puede inscribirse en la misa donde va a querer cantar
> o va a poder cantar, para poder ordenar el coro con las voces y con los instrumentos."*
> *"Se inclinan también con voz, instrumento, y si es con instrumento, tiene que definir cuál."*

Tabla `celebracion_participante` con `coro_id` denormalizado, como manda decisión 8. Cada fila
declara **voz o instrumento, y si es instrumento, cuál** — un campo condicional, no dos sueltos.

**Es la primera escritura de un músico en dato compartido.** Ver §19.5.

**Tensión con B5:** son dos respuestas al mismo problema. La inscripción es una declaración **por
misa** que hace el músico; la disponibilidad de B5 es una predicción **general** que carga el
director. Si conviven, hay que decir qué manda cuando se contradicen — §18-11.

---

**B3 · Modo solo letra**

> *"¿El usuario puede desactivar la herramienta de mostrar las notas de guitarra, sino solamente ver
> la letra?"*

Una columna en `preferencias_lectura` y un control en la barra de lectura. `renderizarCifrado` ya
existe: recibe un parámetro y omite los acordes. Sin acordes a la vista, la barra de diagramas de H5
no corresponde.

**No reabre ningún YAGNI.** §16 descartó *"mostrar/ocultar tablaturas (RF-20)"* porque los
cancioneros de `docs/` no traen tablatura. Esto son **acordes**, no tablaturas.

**Por qué está arriba en el orden pese a ser chica:** quien canta sin instrumento no necesita ver
acordes nunca, y sin ellos la letra respira y se lee más grande. Eso es exactamente el piso de
accesibilidad que declara `PRODUCT.md` — *"hay al menos una persona que ve poco y necesita letra
grande de verdad"*.

**Abierto:** hoy toda preferencia de lectura es **por canto**. Quien solo canta no quiere apagar los
acordes canto por canto: los quiere apagados y punto. Eso pide una preferencia **por perfil**, que
§7 no tiene.

---

**B4 · Rastrear cancioneros online y proponer versiones**

> *"Un agente que esté haciendo scraping de distintas páginas de cancioneros católicos, buscando
> actualizaciones de las versiones que haya de las canciones, y poder tener opciones de actualizar o
> preguntar al administrador si quiere utilizarla."*

**No entra al orden de §19.3. Está en §18-10 con todo su detalle**, porque choca con cuatro
decisiones escritas y porque el freno principal es legal, no técnico.

**Lo que juega a favor:** H9 ya dejó `latinaAAmericana`, `aChordPro` y `desdeElCancionero` con test.
Normalizar cualquier cifrado externo al formato interno **ya está hecho**.

**El conflicto de fondo es de producto:** `PRODUCT.md` define el éxito como *"que la corrección que
hace un músico le llegue a los demás"*. Este repertorio es curado y corregido a oído. Si el director
corrigió un acorde porque en la iglesia sonaba mal, una versión de internet "más nueva" no es mejor:
es peor.

---

**B5 · Ficha del miembro del coro**

> *"Cada vez que se crea un miembro, el coro tiene que ingresar: su antecedente de edad; sexo
> masculino/femenino; en qué tono canta; la disponibilidad que tiene para las fechas de cuando se
> requiera, desde menos probable a más probable."*

Los cuatro campos cuelgan de `coro_acceso`, no de `perfiles`: son atributos de la persona **en ese
coro**. H7 ya construyó la pantalla `/coro/miembros` donde se cargarían.

**Decisión tomada:** se guardan **los cuatro tal cual**, con visibilidad declarada — el director ve
la ficha completa del coro que dirige, el músico no ve datos ajenos. Es una política más fina que
las de §8 y hay que escribirla, no descubrirla. Ver §18-11.

**Queda anotado, sin cambiar la decisión:** la tesitura ya dice qué voz canta una persona con más
precisión que el sexo —hay mujeres contralto y hombres tenor, y la voz no se deriva del sexo de
forma fiable—. Y si de la edad lo que importa es **quién es menor de edad**, ese requisito es más
preciso que el dato crudo, y tiene consecuencias reales en contexto parroquial.

---

**B6 · Audio de referencia para aprender las voces**

> *"Un espacio donde se puedan subir por el teléfono las voces de las melodías de las voces, de los
> cromáticos, de las canciones, para que los miembros del coro puedan escucharlas y aprenderlas."*

**Cambia de categoría el producto: Cantoral hoy no guarda ni un binario.** Todo es texto ChordPro y
SVG dibujado en el servidor. Trae almacenamiento de archivos con políticas propias, grabación desde
el navegador del teléfono, y peso — ver §18-14.

**Sin definir:** *"cromáticos"*. Sin saber qué son, no se modelan.

**Leer antes B11:** un enlace a una versión que ya existe puede cubrir buena parte de *"escucharlas
y aprenderlas"* sin nada de esta infraestructura.

---

**B7 · Cada uno graba su voz y el director las escucha juntas**

> *"Cada usuario pueda hacer sus voces y después el director pueda escucharlas todas juntas a ver
> cómo suenan."*

**No es B6 con más pistas.** Grabar por separado y sumar no produce un coro: produce ruido. Cada
persona canta a su tempo y arranca cuando quiere. Para que suenen juntas, todas tienen que haberse
grabado **contra una misma referencia**.

| Camino | Cómo funciona | Costo |
| --- | --- | --- |
| **Escuchar una por una** | El director evalúa cada voz por separado, sin mezclar nunca | mínimo — puede que ya resuelva el objetivo |
| **Grabar encima** | Cada uno graba escuchando lo ya grabado; la sincronía sale sola porque cada quien se acopla a lo que oye | bajo |
| **Mezclar pistas sueltas** | Todos graban contra un clic y el sistema alinea y mezcla | alto: Web Audio, compensación de latencia, y el retardo del teléfono igual desalinea |

---

**B8 · Corregir acordes en el lugar**

> *"Editar las notas y poder borrar alguno de los acordes si es que se repiten, o poder editar en el
> mismo lugar y cambiar alguna nota manualmente."*

**La entrada más alineada con el propósito escrito** — `PRODUCT.md`: *"que la corrección que hace un
músico le llegue a los demás"*.

**Probablemente nace de H9:** ese hito dejó *Escojo la vida* con **121 acordes pulsables**. Un
conversor de cancionero produce repeticiones, porque en el papel el acorde se escribe una vez y se
sostiene.

| Pieza | Qué es | Costo |
| --- | --- | --- |
| **A · Colapsar repetidos consecutivos** | Motor puro §9. **Arregla la salida de H9 en todos los cantos de una vez** | bajo |
| B · Editar un acorde en el lugar | Choca con el gesto de H5 — §18-15 | medio |
| C · Borrar un acorde suelto | Va con B | — |

**No debería construirse B/C sin versionado — §18-13.**

---

**B9 · Ranking de sugerencias por momento**

> *"Un ranking donde cada miembro sugiere alguna canción para determinado momento de la misa, y el
> director puede escoger la que más se repite o la que más se quiere cantar."*

Tabla `sugerencia` (perfil, canto, momento, coro) y un recuento ordenado al armar la celebración.
Contar y ordenar: determinista.

Segunda escritura del músico en dato compartido — ver §19.5. Y da consejos opuestos a B1: §18-12.

---

**B10 · Estado del canto: en ensayo o listo**

> *"Un segmento donde están las canciones que se están sacando o ensayando y que todavía no están
> para poder cantarlas, y poder identificar aquellas que están para canto."*

**Una columna en `canto`, y la mejor relación valor/costo del backlog**, por dos razones.

**Cierra un pendiente que §16 dejó abierto a propósito.** El borrado quedó fuera diciendo *"hace
falta antes definir si se archiva, se borra en lógico o se prohíbe"*. **El estado es esa
definición**: archivar es un estado más, y borrar deja de hacer falta.

**Y le da orden a casi todo lo demás:** B1 no recomienda cantos que el coro todavía no sabe cantar;
armar la celebración avisa si se mete uno que está en ensayo; y el audio de B6/B11 tiene
destinatario obvio — se sube y se enlaza **lo que está en ensayo**, no lo que ya se canta.

**Abierto:** cuántos estados y cuáles (¿sugerido · en ensayo · listo · archivado?), y si solo el
director los cambia.

---

**B11 · Buscar versiones en YouTube o Spotify**

> *"Hacer un scraping de otras versiones en YouTube o Spotify usando un agente."*

**Prima de B4, pero materialmente distinta en tres frentes:**

| Frente | Diferencia con B4 |
| --- | --- |
| **Técnico** | Ambas plataformas tienen **API oficial de búsqueda**: desaparece el costo mayor de B4 —un adaptador por sitio, que se rompe cuando el sitio cambia el HTML— y queda una llamada con clave |
| **Legal** | Es **enlazar, no copiar**. Guardar el enlace y mostrarlo con el reproductor embebido es el uso que esas APIs contemplan, y saca casi todo el peso de §18-1. **La línea que no se cruza: descargar el audio**, que va contra los términos de ambas |
| **De alcance** | **Compite con B6.** Si el objetivo es *"que puedan escucharlas y aprenderlas"*, un enlace lo resuelve sin almacenamiento, sin grabación, sin cuota y sin el problema de Safari |

**Qué le sigue quedando a B6/B7:** lo que no está en YouTube — los arreglos propios del coro, la
segunda voz que sacaron ellos.

**Sobre "agente":** buscar por título y autor y que **el director elija de una lista** no es IA y no
toca §16. Emparejar automáticamente sí sería difuso —covers, versiones en vivo, títulos que no
coinciden— y ahí recién se discute el veto. Ver §10 y §18-16.

### 19.3 Orden propuesto

Propuesta, no compromiso. El corte importa más que el orden exacto: **las cuatro primeras no tocan
la autorización ni traen infraestructura nueva.** Son columnas y motores puros sobre lo ya
construido y verificado.

| # | Qué entrega | De | Por qué ahí |
| --- | --- | :---: | --- |
| **H10** | Estado del canto: en ensayo / listo | B10 | Una columna. Cierra el pendiente de borrado de §16 y le da orden a casi todo lo demás |
| **H11** | Modo solo letra | B3 | Una columna y un control. Accesibilidad, que `PRODUCT.md` pone como piso |
| **H12** | Colapsar acordes repetidos | B8-A | Motor puro con test. Limpia retroactivamente lo que produjo H9 |
| **H13** | Historial y métricas por canto | B1 A+B | Cero tablas nuevas: H6 ya guarda el dato |
| **H14** | Ficha del miembro | B5 | Extiende H7, que ya tiene la pantalla |
| **H15** | Inscripción a la celebración | B2 | **Acá recién se toca §8**: primera escritura del músico |
| **H16** | Sugerencias y ranking | B9 | Reusa la política que abre H15 |
| **H17** | Recomendación al armar | B1-C | Necesita H10, H13 y H16 |
| **H18** | Corrección en el lugar + versionado | B8 B/C | No debería construirse sin el versionado de §18-13 |
| **H19** | Enlaces a versiones (YouTube / Spotify) | B11 | **Antes del audio propio**: puede reducirle el alcance |
| **H20** | Audio propio de referencia | B6 | Infraestructura nueva: almacenamiento de binarios |
| **H21** | Grabar encima de lo grabado | B7 | Depende de H20 |
| — | Rastreo de cancioneros online | B4 | Fuera del orden: §18-10 |

### 19.4 Vocabulario que introduciría

**§5 no se toca todavía** — se escribe cuando la entrada pase a §17. Pero la desambiguación hay que
fijarla antes de construir nada, porque §5 dice **"no hay sinónimos"** y acá hay una colisión real:

| Término | Qué sería | Qué **no** es |
| --- | --- | --- |
| **estado** | En qué punto está un canto en el coro: en ensayo, listo, archivado | no es el momento litúrgico |
| **tesitura** | La voz de una **persona**: en qué tono canta | **no es "voz"**: esa palabra queda tomada, ver abajo |
| **instrumento** | Qué toca una persona en una celebración | no es la tesitura; una persona puede aportar una u otro |
| **disponibilidad** | Qué tan probable es que alguien pueda, en general | no es la inscripción: eso es por celebración y lo declara el propio músico |
| **inscripción** | Una persona declarando que va a una celebración, con su aporte | no es asistencia confirmada |
| **sugerencia** | Una persona proponiendo un canto para un momento | no es una asignación: asignar sigue siendo del director |
| **pista** | Un audio grabado o enlazado de un canto | **no es una "voz"** aunque en la conversación se le diga así |

**La colisión, explícita:** en el habla del coro "voz" significa las dos cosas —*"Ana hace la
segunda voz"* (tesitura) y *"sube la voz que grabaste"* (pista)—. En el código no puede: **tesitura**
para la persona, **pista** para el audio, y la palabra "voz" no se usa como nombre de nada.

### 19.5 La regla nueva de §8: el músico aporta

Tres entradas del backlog —B2 (me inscribo), B9 (sugiero) y B8 (corrijo)— traen lo mismo: **el
músico escribiendo en dato compartido**, que hoy §8.2 no contempla. No son tres excepciones: es una
categoría que falta.

**Decidido (2026-08-06):** el músico **escribe solo filas suyas**.

| Puede | No puede |
| --- | --- |
| Crear y borrar **su** inscripción a una celebración del coro al que pertenece | Inscribir o desinscribir a otra persona |
| Crear y retirar **su** sugerencia | Borrar la sugerencia de otro, o asignar un canto a una celebración |
| — | Editar cantos, celebraciones, miembros ni datos de nadie |

Es aporte **no destructivo**: agrega sin pisar. Se escribe en §8.2 —y en la política de RLS, que es
donde de verdad se hace cumplir, según §15-4— el día que se construya H15, no antes.

**Nota:** B8 (corregir acordes) **no queda cubierta por esta regla.** Corregir un acorde modifica el
canto de todos, no una fila propia. Sigue siendo del director, como dejó verificado H8, hasta que
exista el versionado de §18-13.

### 19.6 Lo que no entró al backlog

- **La búsqueda online de cifrados de §16 sigue descartada.** B4 y B11 no la reviven: B4 está
  frenada en §18-10 y B11 busca **grabaciones**, no cifrados.
- **§16 no perdió ninguna fila.** La única que cambió es la del borrado, y solo para decir que ya
  tiene candidato de respuesta.
- **§18-6 sigue abierto** —si la celebración sin fecha se siente forzada como sustituto de una lista
  libre—. La captura no lo respondió, y B10 no lo reemplaza: son cosas distintas.

---

*Documento vivo. §1–§18 describen lo construido y verificado; §19 es el backlog capturado y sin
comprometer. El eslabón para construir sigue siendo `prd-a-codigo`, y toma de §17, no de §19.*
