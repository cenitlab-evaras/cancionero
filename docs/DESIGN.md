# Design

Sistema visual de Cantoral. Los valores viven en `app/globals.css`; esto explica **por qué**.
La especificación de producto está en `docs/PRD.md` §11; este documento la desarrolla, no la
contradice.

**Rediseño del 2026-10-17.** Una crítica de diseño puso la app en 20/40: la lectura estaba bien
resuelta y todo lo demás era un boceto sobre buenos tokens. El dueño pidió que fuera **más cálida,
con identidad y fácil de navegar**. Este documento describe el sistema que salió de ahí.

## Visual Theme

**Tema oscuro y cálido, sin conmutador.** La escena sigue siendo la iglesia a las ocho de la tarde
con el músico de pie y la guitarra puesta, pero con su luz real: lámparas amarillas y velas, no un
gris de oficina. Un tema claro obligaría a competir con esa oscuridad (PRD decisión 8).

**La identidad sale del logo del coro**: San José con el Niño, un halo dorado sobre fondo café-negro.
De ahí el fondo (Nave) y el color de marca (Halo). El logo va en la cabecera, en un círculo.

La referencia de patrón es la lectura de Ultimate Guitar —acorde cálido sobre monoespaciado,
controles en barra inferior— sin nada de su ruido. La referencia de **estructura** es el cancionero
impreso: momentos litúrgicos y cantos numerados. La de **tono** es un misal: títulos en serif,
rúbricas sobrias.

Estrategia de color: **contenida, con identidad**. Neutros con el matiz café del logo, un halo dorado
para la marca y la acción, y un ámbar que solo usan los acordes.

## Color Palette

Todos los tokens en OKLCH. Contraste medido contra el fondo (Nave).

| Token | Nombre | Valor | Uso | Contraste |
| --- | --- | --- | --- | --- |
| `--color-fondo` | Nave | `#15110D` | fondo de la app: el café-negro del logo | — |
| `--color-superficie` | Banca | `#221B15` | barras, campos, hojas | — |
| `--color-superficie-alta` | | `#2D241C` | hover, fila activa, interruptor encendido | — |
| `--color-borde` | | `#3A3027` | separadores, **no** controles | 1,5:1 |
| `--color-borde-fuerte` | | `#7A6A58` | borde de todo control interactivo | 3,6:1 |
| `--color-texto` | Marfil | `#F0E8DA` | letra del canto y texto principal | 15,4:1 |
| `--color-texto-tenue` | Ceniza | `#B3A594` | metadatos, ayudas | 7,8:1 |
| `--color-acorde` | Ámbar | `#FF9D3D` | **el acorde, y nada más** | 9,1:1 |
| `--color-acento` | Halo | `#E4B85A` | marca, lugar activo, acción principal, enlaces | 10,1:1 |
| `--color-sobre-acento` | | = Nave | el texto ENCIMA del halo | 10,1:1 |
| `--color-peligro` | | `#E5674F` | sin acceso, error, quitar | 5,7:1 |
| `--color-exito` | | `#6FBF73` | confirmación | 8,4:1 |

**La regla del acorde, reescrita para la paleta cálida.** El Ámbar del acorde y el Halo de la marca
se distinguen **solo por tono**: en luminosidad son casi iguales (1,1:1). Por eso:

1. `--color-acorde` es solo para acordes y tonalidades (la del canto en una fila, la de la barra de
   lectura). Nunca para un contador, un número, un ícono ni un borde.
2. **El Halo nunca aparece en la vista de lectura ni en la de ejecución.** Ahí lo único cálido de
   la pantalla es el acorde; los controles van en marfil y superficie.

Se rompió tres veces antes del rediseño (el interruptor de acordes, el contador de `/historial`, los
contadores de sugerencias). Cómo se detecta: comparar en el navegador `getComputedStyle` de un control
contra el de un `.acorde-tocable`; si dan el mismo color, la regla está rota.

**Sobre el halo, texto oscuro.** El azul anterior con texto blanco daba 3,7:1 y no llegaba a AA. El
halo con blanco encima daría 1,6:1; con Nave encima da 10,1:1.

**El halo como resplandor** (`.halo`) se usa en **un solo lugar**: detrás de la próxima misa en
Inicio. Es la firma del coro; repetido en tarjetas y botones perdería su sentido.

## Typography

Tres familias, cada una con un trabajo, en ejes distintos (sans · serif · mono):

- **Interfaz: Atkinson Hyperlegible Next.** Se diseñó para personas con baja visión: distingue
  `l`/`I`/`1` y `b`/`6`, que en una sans neutra se confunden. En el coro hay alguien que ve poco, y
  la regla es que la app entera le sirva. Reemplazó a Inter el 2026-10-17 (el detector de la crítica
  la marcaba como «fuente sobreusada»).
- **Títulos: Source Serif 4** (`.titulo-libro`), con eje óptico. La letra del cancionero impreso y
  del misal, en títulos de canto, de misa y de pantalla. Los números del cancionero van en sus
  números de estilo antiguo (`.numero-libro`), no en monoespaciada: son del libro, no un dato técnico.
- **Cifrado: JetBrains Mono.** Ancho de carácter estable en 0.6em, que es lo que sostiene la
  alineación de los acordes sobre la letra. `cifrado.tsx` calcula con ese ancho: no se cambia la
  fuente sin cambiar ese número.

Las tres se cargan con `next/font` (autoalojadas).

Escala **fija en rem**, sin `clamp()`:

| Rol | Tamaño | Familia · peso |
| --- | --- | --- |
| Próxima misa (Inicio) | 2rem | serif 600 |
| Título de pantalla | 1.75rem | serif 600 |
| Título de canto | 1.375rem (1.5 en la misa) | serif 600 |
| Título de sección (`TituloSeccion`) | 0.9375rem | sans 700, **sin mayúsculas** |
| Cuerpo / fila | 1rem | sans 400 |
| Metadato y ayuda | 0.875rem | sans 400 |

**Nada de mayúsculas espaciadas** (ENTRADA, QUIÉN VA): a 13 px y en tenue se leen lento justo para
quien ve poco, y eran el tic de plantilla más visible de la crítica. **Nada por debajo de 0.875rem**
en lo que se lee.

**El cifrado es la excepción**: su tamaño lo elige la persona (14–32 px, RN-14 revisada) y vale en
todo el repertorio. El ajuste al ancho parte el verso en menos columnas a medida que crece, para que
el aumento se note en un teléfono angosto. Interlineado 1.9.

## Layout

- Columna única de 42rem máximo, centrada, alineada a la izquierda.
- **Navegación: cabecera de identidad arriba, barra de destinos abajo** (2026-10-17).
  - Arriba, 56 px (`h-14`): el logo del coro y su nombre, que llevan a Inicio. Nada más compite ahí.
    Los `sticky` que cuelgan debajo usan `top-14`.
  - Abajo, fija, donde llega el pulgar: **Inicio · Repertorio · Misas · Más**, ícono y texto siempre.
    El lugar activo se marca con halo, peso y una barra de 3 px: no depende solo del color. Lo que no
    entra en cuatro vive en «Más» (Historial, Sugerencias, Miembros, Mi perfil, Salir).
  - Antes eran dos filas arriba a 40 px, con Historial y Sugerencias escondidos al pie de un
    repertorio de 4 700 px y «Salir» a un toque en plena misa.
- **La lectura y la ejecución no llevan esa navegación.** Solo una barra fija de 44 px arriba
  (volver, el título, los dos controles que no son de tocar) y la barra de lectura abajo. Mientras se
  toca no hay a dónde ir. En la ejecución, «Siguiente: *nombre del canto*» va abajo, sobre la barra
  de lectura.
- En la lectura el cifrado va **a sangre**, sin tarjeta, pero con su margen de 16 px alineado con el
  título. Lo que se decide planificando —historial, proponer, correcciones— va **al pie** del canto,
  nunca entre el título y el primer acorde.
- Escala de espaciado 4 · 8 · 12 · 16 · 24 · 32 · 48.
- Escala de z-index semántica: `--z-barra: 10`, `--z-cabecera: 20`, `--z-modal: 40`. Nunca 999.

## Components

Vocabulario único en toda la aplicación.

- **`BotonIcono` / `EnlaceIcono`** (`boton-icono.tsx`): 44×44 mínimo, siempre con nombre accesible.
  Cuatro apariencias: `plano` (cabeceras), `activo` (interruptor encendido), `borde` (barras de
  herramientas, controles normales, borde a 3:1) y `lleno` (la acción principal, en el halo).
- **Íconos** (`iconos.tsx`): dibujados, trazo de 1,75 sobre grilla de 24. **Nunca glifos de texto**
  (← ✕ ✎ + ↑ ↓): cambian de forma según la fuente del sistema y un ← de 16 px no es un objetivo.
  Sin cruces ni símbolos religiosos decorativos (PRODUCT.md): la misa se dibuja como una fecha.
- **`TituloSeccion`**: el único título de sección.
- **Control táctil**: 44 px de alto en toda la app (antes 40 en gestión; con la barra abajo y el
  vocabulario único no valía la pena la diferencia). Borde `--color-borde-fuerte`.
- **Estados obligatorios** en todo interactivo: reposo, hover, **foco visible** (anillo de 2 px en el
  halo con 2 px de separación), activo, deshabilitado (opacidad 0.4).
- **Fila de canto**: no es una tarjeta. Número del cancionero a la izquierda (`.numero-libro`),
  título, autor debajo y tonalidad a la derecha. **La columna izquierda es solo el número del
  cancionero**: orden en la misa, veces cantado o votos van a la derecha, en tenue y con su unidad.
- **Estados vacíos y de error**: explican el motivo y ofrecen el paso siguiente con un botón del
  sistema. `app/loading.tsx` dibuja un esqueleto; `error.tsx` y `not-found.tsx` llevan a Inicio.
- **Avisos de guardado**: cuando una preferencia no se guarda se dice, abajo y sin tapar el canto.

## Motion

Producto en flujo: **150–200 ms**, curva `ease-out`. La motion comunica estado —hover, foco,
aparición de la barra— y nada más. No hay secuencias de entrada de página: el músico abre la app
para tocar, no para verla cargar.

**La pantalla no se apaga mientras se lee** (`PantallaEncendida`, Wake Lock): en la lectura y en la
ejecución de la misa. Si el navegador no lo permite, la app sigue igual.
