# Auditoría de UI y UX — Cantoral

**Fecha:** 17 de noviembre de 2026 · **Alcance:** `app/` (24 rutas, 20 componentes compartidos)
**Método:** recorrido real de la app con Playwright a 390×844 px, en tema oscuro y claro, como
`director@` y como `musico@`; medición en el DOM de overflow, objetivos táctiles, tamaños de texto,
contraste calculado, nombres accesibles, jerarquía de encabezados y foco; más lectura del código
contra `docs/DESIGN.md` y `docs/PRD.md`.

Pantallas medidas: Inicio, Repertorio, Canto (lectura), Misas, Misa, Ejecución de la misa, Más,
Historial, Sugerencias, Mi perfil, Miembros, Herramientas, Canciones, Archivados, Ensayar,
Editar canto, Editar misa y Entrar, en oscuro; las principales también en claro; Inicio,
Repertorio, Misa y Más como miembro.

---

## 1. Veredicto

**37 / 40 tras los arreglos del mismo día** (33/40 en la primera pasada). El rediseño del 17 de
octubre cumplió: hay un sistema con identidad propia, una tipografía elegida con motivo, una
navegación que responde a cómo se usa la app y estados vacíos que explican. Ya no parece una
plantilla. La segunda pasada cerró los dos fallos de accesibilidad, las contradicciones entre el
sistema y su implementación y la limpieza pendiente; queda solo el formato del campo de fecha, que
lo decide el navegador.

| Dimensión | Nota | Comentario |
| --- | --- | --- |
| Identidad y dirección visual | 9/10 | Tema oscuro cálido + papel claro, halo único, cifrado como lenguaje. Se reconoce como Cantoral. |
| Tipografía | 8/10 | Tres familias con trabajo claro; la escala se respeta salvo 12 px residuales. |
| Color y contraste | 9/10 | Todos los textos y controles medidos ≥ AA; el botón destructivo pasó de 3,29 a 5,71:1. |
| Layout y navegación | 9/10 | Columna única, barra al pulgar, activo por color + peso + barra. Cero overflow en 16 pantallas. |
| Componentes y estados | 9/10 | Botón/EnlaceIcono y TituloSeccion bien; casillas e interruptores ya siguen el sistema. |
| Accesibilidad | 9/10 | Foco inmediato y visible, un `h1`, labels, áreas de 44; queda el formato nativo de la fecha. |
| UX y copy | 9/10 | Tono consistente; el gesto de archivar ya se explica y el copy de Archivados está al día. |
| Consistencia técnica | 9/10 | `titulo-pantalla` consolidado, sin `space-y` de layout, sin colores crudos. |

**Cero desbordes horizontales** en las 16 rutas medidas, en ambos temas y ambos roles. **Un solo
`h1`** por pantalla. **Foco visible** de 2 px con 2 px de separación. **Movimiento reducido**
respetado globalmente. Esos cuatro son la base de que la app se sienta sólida.

---

## 2. Lo que está bien y conviene no tocar

1. **El sistema de color tiene una regla y la cumple.** El ámbar es del acorde y nada más; el halo
   es de la marca y la acción. Los contrastes medidos coinciden con `DESIGN.md` (texto 15,4:1,
   tenue 7,8:1, acento 10,1:1). El tema claro no es una inversión automática: es papel de cancionero
   con tinta café, y se ve medido.
2. **La lectura es el producto y está resuelta.** El cifrado monoespaciado con la letra en marfil,
   la barra al pulgar con cinco controles como máximo, el tamaño de letra por persona y el
   auto-scroll. No hay decoración compitiendo con el canto.
3. **La navegación responde a la escena.** Cabecera de identidad arriba, cuatro destinos abajo,
   lo demás en «Más». El activo no depende solo del color: halo, peso y barra de 3 px. Perfecto
   para daltonismo y para el sol de la tarde.
4. **Los estados no son un afterthought.** `loading.tsx` es un esqueleto con la forma del contenido;
   `error.tsx` y `not-found.tsx` están en español y ofrecen salida; los vacíos explican el motivo
   («Cuando el director cargue cantos, vas a verlos acá»). Eso es más de lo que hace la mayoría.
5. **La jerarquía tipográfica es de libro.** Source Serif para títulos, Atkinson para interfaz,
   JetBrains para cifrado; sin mayúsculas espaciadas en los títulos de sección, que era el tic que
   la crítica anterior señalaba.
6. **Los formularios tienen labels reales.** Verifiqué que los 8 campos de editar canto y los de
   Mi perfil usan `<label>` envolvente o `htmlFor`; los avisos de búsqueda tienen `<span class="sr-only">`.
   El audit inicial los marcó «sin nombre» porque no consultaba `el.labels`: **falsos positivos**.
   Lo mismo los checkboxes de filtros, dentro de un label de 44 px.

---

## 3. Hallazgos

Severidad: **P0** rompe accesibilidad o la acción principal; **P1** contradice el sistema o
perjudica el uso; **P2** limpieza o mejora.

### P0 — Accesibilidad

#### 3.1 El botón destructivo no llega a AA · 3,29:1

`app/componentes/deslizable.tsx:78`
`bg-peligro` (#E5674F) con `text-white`. Medido en el navegador: **3,29:1**. Para texto normal
(16 px, 700) el mínimo es 4,5:1; el tamaño no alcanza para la excepción de «texto grande»
(≥18,66 px en negrita). Es justo el botón que confirma **Archivar** o **Quitar**.

**Arreglo:** texto en Nave, no blanco. `--color-peligro` contra el fondo da 5,71:1; al revés,
un texto `--color-fondo` sobre peligro da el mismo 5,71:1. Añadir un token semántico
(`--color-sobre-peligro: var(--color-fondo)`) y usar `text-sobre-peligro`. Evita que vuelva a
pasar en el próximo botón rojo.

#### 3.2 El selector «¿Quién canta?» mide 30 px y su borde no llega a 3:1

`app/componentes/marca-estrofa.tsx:47`
`border-borde` (1,5:1) y `py-1` con `-my-1`: **118×30 px**. Es un control interactivo dentro de la
lectura, que es el momento con menos precisión del pulgar (de pie, con la guitarra puesta). El
borde de un control debe llegar a 3:1 (WCAG 1.4.11); el sistema ya tiene `--color-borde-fuerte`
(3,6:1) para eso.

**Arreglo:** `border-borde-fuerte` y un área táctil de 44 px sin mover la línea de texto — el
mismo truco que ya usa `.acorde-tocable::after` (`inset: calc((44px - 1em)/-2)`). No hace falta
cambiar el `<select>` nativo: la rueda del sistema es la decisión correcta para este gesto.

### P1 — Contradicciones con el sistema

#### 3.3 La barra inferior escribe a 12 px; el sistema prohíbe menos de 14

`app/componentes/destinos-nav.tsx:52` — `text-xs` en los cuatro destinos, en todas las pantallas.
`DESIGN.md` dice: «Nada por debajo de 0.875rem en lo que se lee», y la razón es la persona con baja
visión que motivó Atkinson. Hay lugar: a 14 px, «Repertorio» entra en 97 px de ancho (390/4).

**Decisión:** subir a 13–14 px o documentar la excepción en `DESIGN.md` con el motivo. Lo que no
conviene es que el documento diga una cosa y la pantalla otra.

#### 3.4 El tablero de Inicio reintroduce lo que el rediseño eliminó

`app/page.tsx:426` — `Chico` usa `text-xs font-bold tracking-wide uppercase`: **12 px en mayúsculas
espaciadas**, exactamente el tic que `TituloSeccion` vino a enterrar. Se ve en «TAMBIÉN PENDIENTE»
y «SE ESTÁ ENSAYANDO».
`app/page.tsx:437` — `FilaChica` usa `min-h-9` (**36 px**): por debajo del control táctil de 44 px.
`app/page.tsx:413` — `FilaDeAvance` dibuja `✓` como **glifo de texto**. La regla de íconos lo
prohíbe: cambia de forma y tamaño según la fuente.

**Arreglo:** usar `TituloSeccion` en `Chico` (15 px, peso fuerte, sin mayúsculas), `min-h-11` en
`FilaChica` y un `IconoHecho` dibujado con la misma grilla de 24 que el resto.

#### 3.5 Las marcas «Ensayar» miden 26 px de ancho

`app/repertorio/fila-canto.tsx:68` y `:77` — `px-1` deja el enlace en **26×44**. El alto cumple;
el ancho no. En una fila que ya tiene título + tonalidad + asa, dos objetivos de 26 px pegados son
fáciles de errar con el pulgar.

**Arreglo:** `px-3` (44 px de ancho) o agruparlas en un solo control. Si se agrandan, revisar que
el título siga teniendo espacio a 360 px.

#### 3.6 Los interruptores encendidos usan el halo, que el sistema reserva

`app/herramientas/interruptor.tsx:49` — `bg-acento`. `DESIGN.md` dice que el halo es marca, lugar
activo y acción principal, y que `--color-superficie-alta` es «hover, fila activa, **interruptor
encendido**». Con cuatro interruptores encendidos a la vez, el halo deja de ser la firma del coro.
Además, el componente `BotonIcono` ya tiene la apariencia `activo` con esa semántica.

**Decisión:** volver a `superficie-alta` + texto pleno, o aceptar el cambio y actualizar
`DESIGN.md` (el halo como estado sí se defiende por claridad). No dejarlo a medias.

#### 3.7 El texto de Archivados quedó viejo y el gesto no se descubre

`app/repertorio/archivados/page.tsx:63` — «Cuando saques uno del repertorio desde «Editar»…».
Desde el gesto nuevo también se archiva deslizando. Actualizar a «desde «Editar» o deslizándolo
en el repertorio».

Y el problema mayor: **un gesto oculto sin pista no se descubre**. El camino accesible existe
(Editar → Archivar), así que no es un bloqueo, pero el atajo que se pidió no se ve. Opciones, de
menor a mayor costo: una línea bajo el título del repertorio solo para el director («Desliza un
canto para archivarlo»), una pista que aparece la primera vez y se recuerda en cookie, o un
`Chevron`/asa que insinúe el gesto. La primera es la más honesta con el tono de la app.

#### 3.8 En Canciones, navegar exige acertar a un enlace de 24 px

`app/canciones/page.tsx:155` — el título es un enlace de **24 px de alto**; la fila de la tabla no
navega. En el teléfono, tocar el espacio entre el título y el momento no hace nada. **Arreglo:**
que la fila entera sea el enlace (o un `::after` que cubra la celda) manteniendo el `<table>`.

#### 3.9 Formularios: la fecha y una aclaración

- **«Procedencia (de dónde salió)» no es un defecto:** es el `<summary>` de un `<details>` que
  agrupa tres campos, y cada uno de esos campos tiene su label visible («Cancionero», «N.º de
  canto», …). Verificado en el código.
- El campo de fecha de Mi perfil muestra `mm/dd/yyyy` y el calendario nativo en la captura de
  Chromium. El formato lo decide el locale del navegador, no el `lang="es"`; en el iPhone del dueño
  probablemente será distinto. Si molesta, un campo de texto con validación explícita es la única
  forma de controlarlo. **No es un defecto grave**, pero es el único lugar de la app donde la
  interfaz habla en inglés.

#### 3.10 Más trunca las descripciones que explican

`app/mas/opciones.tsx:91` — `truncate` en `detalle`: en 390 px, «Qué se canta seguido y qué se está
deja…», «Quién canta cada estrofa, tu cuerda, dar …». Para una app pensada para baja visión,
cortar la ayuda justo donde explica es contraproducente. **Arreglo:** `line-clamp-2` o dejar que
la fila crezca.

### P2 — Limpieza

1. **34 `text-[1.75rem]`** repartidos en 20 archivos: crear `.titulo-pantalla` en `globals.css`
   (o un `TituloPantalla`) y usarlo. Mismo valor, una fuente de verdad.
2. **6 `space-y-*`** (`loading.tsx`, `cifrado.tsx`, `corregir.tsx`, `mi-perfil`, `entrar`): `flex
   flex-col gap-*`, como pide el vocabulario de shadcn y como ya hace el resto.
3. **Checkboxes nativos** en `/canciones` (`filtros.tsx:110`): `accent-color` cambia entre
   navegadores y en la captura de Chromium no toma el halo. Un control propio (o `ToggleGroup`)
   daría el mismo estado en todas las plataformas. El área táctil ya es correcta (label de 44).
4. **«1» sin unidad en Misas** (`app/misas/page.tsx:147`): los anotados se cuentan con un número
   `aria-hidden` al lado de los avatares. Visualmente se adivina; para lector de pantalla no existe.
   Cambiar a «1 anotado» (visible o `sr-only`) resuelve las dos cosas.
5. **`text-white`** en `deslizable.tsx` es el único color crudo del código: al corregir P0, añadir
   el token y dejar el sistema cerrado otra vez.

---

## 4. Flujos de uso

| Flujo | Qué se ve | Fricción |
| --- | --- | --- |
| **Llegar** | Entrar limpio, en español, con explicación de cómo se obtiene cuenta | Ninguna. El botón de entrar es el único halo, correcto. |
| **Ver la próxima misa** | Inicio-tablero con anillo, voces por cuerda y «Para que quede lista» | El bloque chico de Inicio vuelve al estilo de plantilla (3.4). |
| **Elegir un canto** | Repertorio por momentos, buscador global fijo, lupa en el título | Descubrir Ensayar depende de marcas de 26 px (3.5). El gesto de archivar no se insinúa (3.7). |
| **Leer** | La mejor pantalla del producto: cifrado a sangre, barra al pulgar, tono y tamaño | El select de estrofa es el único control que no cumple el mínimo (3.2). |
| **Ensayar** | Estado vacío claro y botón «Ver el cifrado» | Si no hay partitura, no dice cómo conseguirla; para el director es un callejón sin salida. Sugerir «Cómo subir una partitura» o el importador. |
| **Armar la misa** | Muy bueno: reordenar por momento, tono, propuestas, agregar con «hace N meses» | Alta densidad, pero con jerarquía. Sin fricción grave. |
| **Ejecutar la misa** | «1 de 2», anterior/siguiente, barra de lectura, siguiente canto | Ninguna. |
| **Administrar** | Miembros y roles con selects nativos de 44; reglas explicadas | Bien. |

---

## 5. shadcn/ui: ¿conviene?

**Veredicto: no migrar. Sí adoptar tres ideas puntuales, y solo si resuelven un problema concreto.**

El proyecto **no usa shadcn** (`components.json` no existe, 0 componentes instalados) y tiene algo
que shadcn no da: un sistema propio con tokens propios, tipografía propia, una regla de color
explicada y 24 pantallas que ya la siguen. Migrarlo implicaría:

- reescribir `globals.css` al vocabulario `primary/muted/background` (o mantener dos fuentes de
  verdad, que es peor);
- reemplazar `BotonIcono`, `TituloSeccion`, las filas y la barra por `Button`, `Card`, etc., y
  volver a aplicarles el sistema encima;
- revisar 24 pantallas para que nada cambie de tamaño, foco ni contraste;
- sumar dependencias (Radix o Base UI) y una capa de composición que hoy no existe.

El costo es alto y el beneficio sería **accesibilidad de controles complejos** que el proyecto casi
no tiene: no hay diálogos ni menús desplegables; hay un `<select>` nativo deliberado, una tabla
semántica y confirmaciones en línea. shadcn no mejora eso.

### Lo que sí tomaría

| Necesidad real | shadcn aportaría | Decisión |
| --- | --- | --- |
| «¿Quién canta?» (3.2) | `Select` de Radix, 44 px y accesible | **No.** Perdería la rueda nativa del sistema, que es mejor de pie con la guitarra. Se arregla con hit area y borde. |
| Filtros de Canciones (P2.3) | `Checkbox` con estados consistentes | **Sí, si se toca.** O un `ToggleGroup` propio con los tokens; no hace falta instalar el sistema entero. |
| Confirmación de archivar | `AlertDialog` | **No hoy.** Son dos pasos (deslizar + tocar) y en Editar hay confirmación propia. Si se agrega un modal, sí hacerlo con primitiva accesible (foco atrapado, Escape). |
| Avisos de guardado | `sonner`/`toast` | **No.** Los `role="status"` en línea no tapan el canto y funcionan sin JavaScript extra. |
| Esqueleto de carga | `Skeleton` | **No.** `loading.tsx` ya tiene la forma del contenido. |

### Reglas de shadcn que ya se cumplen (y conviene mantener)

- Tokens semánticos en vez de colores crudos: se cumple, salvo `text-white` (P0).
- Sin `dark:` manual: el tema es por tokens y `data-tema`. Se cumple.
- Íconos dibujados y con nombre accesible: se cumple, salvo el `✓` (3.4).
- `size-*` cuando ancho y alto son iguales: casi siempre; quedan `h-7 w-12` y `h-8 w-40`.
- Sin `z-index` manual: se cumple (escala semántica).
- Formularios con label asociado: se cumple.

### Si algún día se adopta

Hacerlo en una rama, empezando por `npx shadcn@latest init` y el mapeo de tokens de
`design-system.md`, con una pantalla de sistema de diseño antes de tocar una sola pantalla real.
Nunca a mitad de un rediseño.

---

## 6. Plan sugerido

| # | Qué | Dónde | Esfuerzo |
| --- | --- | --- | --- |
| P0.1 | Token `sobre-peligro` y texto oscuro en el botón rojo | `deslizable.tsx`, `globals.css` | 20 min |
| P0.2 | Select de estrofa a 44 px de área y borde fuerte | `marca-estrofa.tsx`, `globals.css` | 30 min |
| P1.1 | Barra inferior a 14 px (o excepción documentada) | `destinos-nav.tsx` | 15 min |
| P1.2 | Inicio: `TituloSeccion`, `min-h-11`, ícono en vez de `✓` | `page.tsx`, `iconos.tsx` | 45 min |
| P1.3 | Marcas Ensayar a 44 px de ancho | `fila-canto.tsx` | 15 min |
| P1.4 | Copy de Archivados + pista del gesto | `archivados/page.tsx`, `repertorio/page.tsx` | 30 min |
| P1.5 | Interruptores: decidir halo o superficie y documentarlo | `interruptor.tsx` o `DESIGN.md` | 15 min |
| P1.6 | Fila entera enlazada en Canciones | `canciones/page.tsx` | 30 min |
| P1.7 | Label de Procedencia y revisar fecha | `formulario-canto.tsx`, `mi-perfil` | 20 min |
| P1.8 | Descripciones de Más a dos líneas | `mas/opciones.tsx` | 10 min |
| P2 | `titulo-pantalla`, `space-y`, checkboxes, «anotado» | varios | 2 h |

Verificación de cada arreglo: repetir este mismo recorrido (Playwright, 390 px, ambos temas) y
comprobar que no aparece overflow, que el objetivo nuevo mide ≥44 y que el contraste calculado
supera 4,5:1. Las capturas de esta auditoría quedaron en `/private/tmp/auditoria/`.

---

## 7. Anexo — métricas por pantalla (director, oscuro, 390 px)

| Pantalla | Overflow | `h1` | Texto <14 px | Contraste <AA | Táctil <44 |
| --- | --- | --- | --- | --- | --- |
| Inicio | 0 | 1 | 6 (nav + 2 títulos de 12) | 0 | 2 (filas de 36) |
| Repertorio | 0 | 1 | 4 (nav) | 0 | 3 (marcas de 26) |
| Canto | 0 | 1 | 1 («original») | 0 | 1 select de 30 (resto: acordes con área extendida) |
| Misas | 0 | 1 | 8 (nav + metadatos) | 0 | 0 |
| Misa | 0 | 1 | 4 (nav) | 0 | 0 |
| Más | 0 | 1 | 4 (nav) | 0 | 0 |
| Historial | 0 | 1 | 4 (nav) | 0 | 0 |
| Sugerencias | 0 | 1 | 4 (nav) | 0 | 0 |
| Mi perfil | 0 | 1 | 4 (nav) | 0 | 0 |
| Miembros | 0 | 1 | 4 (nav) | 0 | 0 |
| Herramientas | 0 | 1 | 4 (nav) | 0 | 0 |
| Canciones | 0 | 1 | 4 (nav) | 0 | 17 (16 son checkboxes dentro de label 44; 1 título de 24) |
| Archivados | 0 | 1 | 4 (nav) | 0 | 0 |
| Ensayar | 0 | 1 | 4 (nav) | 0 | 0 |
| Editar canto | 0 | 1 | 4 (nav) | 0 | 0 |
| Editar misa | 0 | 1 | 4 (nav) | 0 | 0 |

El botón rojo (3,29:1) no aparece en la tabla porque está `aria-hidden` hasta deslizar; se midió
aparte, con la fila abierta. Los acordes (44 por página en el canto) y los checkboxes son falsos
positivos de tamaño: los primeros extienden su área con `::after`, los segundos viven dentro de un
label de 44 px.

---

## 8. Estado al cierre (mismo día)

Todos los hallazgos accionables se corrigieron y se volvieron a medir en la app, a 390 px, con el
servidor recién compilado.

| Hallazgo | Cambio | Verificación |
| --- | --- | --- |
| P0.1 Botón destructivo 3,29:1 | Token `--color-sobre-peligro` (Nave en oscuro, blanco en claro); `text-sobre-peligro` | **5,71:1** medido sobre el botón abierto |
| P0.2 Select de estrofa 30 px / borde 1,5:1 | `border-borde-fuerte` + `.control-estrofa::after` de ±7 px | Borde **3,61:1**; área efectiva **44 px** |
| P1.1 Nav a 12 px | `text-sm` | Computado **14 px** |
| P1.2 Inicio: 12 px mayúsculas, filas de 36, glifo ✓ | `TituloSeccion`, `min-h-11`, `IconoListo` | h2 **15 px**, `text-transform: none`, fila **44 px**, sin `✓` |
| P1.3 Marcas Ensayar de 26 px | `min-w-11` | **44×44** las tres |
| P1.4 Copy y descubribilidad del gesto | Texto de Archivados actualizado y línea «Desliza un canto…» para el director | Visible en Repertorio |
| P1.5 Interruptores en halo | Encendido en `superficie-alta`, perilla en texto; apagado en `superficie` | Track #2D241C / perilla #F0E8DA encendido; #221B15 / #B3A594 apagado |
| P1.6 Enlaces de 24 px en Canciones | `after:absolute after:inset-0` en el enlace del título | Tocar el borde de la fila navega |
| P1.7 «Procedencia» | No era defecto: es el `<summary>` de un `<details>`; los campos internos tienen label | Verificado en código |
| P1.8 Descripciones truncadas en Más | `line-clamp-2` | 2 líneas, alto 40 |
| P2.1 34 títulos repetidos | `.titulo-pantalla` | 34 usos, **0** `text-[1.75rem]` |
| P2.2 `space-y` de layout | `flex flex-col gap-*` | 0 (queda el `-space-x` intencional de los avatares) |
| P2.3 Casillas nativas | Casilla dibujada con `peer-checked`, input `sr-only` y foco por `.casilla:has(...)` | Marcada: fondo halo y tilde Nave; foco inmediato de 2 px |
| P2.4 «1» sin unidad en Misas | `sr-only` con «1 anotado» / «N anotados» | Presente en el DOM |
| P2.5 `text-white` | Eliminado del código (solo queda en comentarios) | 0 en JSX |

**Verificación global final:** 0 px de overflow en las 12 rutas medidas, 0 errores de consola,
`tsc` limpio, `eslint` limpio, **623 tests en verde**.

**Un detalle que apareció al arreglar la casilla:** `transition-colors` de Tailwind incluye
`outline-color`, así que el anillo de foco tardaba 160 ms en aparecer. Se limitó la transición a
`background-color, border-color, color`; el foco ahora es instantáneo. Si se agregan más controles
dibujados con `peer`, conviene usar la misma lista.

**Lo único que queda abierto** es el formato del campo de fecha de Mi perfil, que lo decide el
locale del navegador. No se puede fijar sin reemplazar el control nativo; se deja documentado.
