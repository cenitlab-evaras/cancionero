# Design

Sistema visual de Cantoral. Los valores viven en `app/app/globals.css`; esto explica **por qué**.
La especificación de producto está en `docs/PRD.md` §11; este documento la desarrolla, no la
contradice.

## Visual Theme

**Tema oscuro único, sin conmutador.** No es preferencia estética: la escena es una iglesia a las
ocho de la tarde, el músico de pie con la guitarra puesta. Un tema claro obligaría a competir con
esa oscuridad. La decisión está cerrada en el PRD (decisión 8).

La referencia de patrón es la vista de acordes de Ultimate Guitar —acorde cálido sobre
monoespaciado, controles en barra inferior— sin nada de su ruido. La referencia de **estructura** es
el cancionero impreso: el coro piensa en momentos litúrgicos y en cantos numerados.

Estrategia de color: **restrained**. Neutros tintados + un acento cálido que solo usan los acordes.
Ningún otro elemento compite por ese color.

## Color Palette

Todos los tokens en OKLCH, con el hex de origen del PRD §11 como comentario. OKLCH permite mover
luminosidad sin que el matiz derive, que es lo que hace falta para derivar estados.

| Token | Valor | Uso |
| --- | --- | --- |
| `--color-fondo` | `oklch(0.145 0 0)` | fondo de la aplicación (#0F0F0F) |
| `--color-superficie` | `oklch(0.196 0 0)` | barras, campos, elemento contenedor (#1A1A1A) |
| `--color-superficie-alta` | `oklch(0.245 0 0)` | hover, fila seleccionada (#242424) |
| `--color-borde` | `oklch(0.27 0 0)` | separadores (#2A2A2A) |
| `--color-borde-fuerte` | `oklch(0.38 0 0)` | borde de control interactivo: necesita 3:1 |
| `--color-texto` | `oklch(0.925 0 0)` | letra del canto y texto principal (#E8E8E8) |
| `--color-texto-tenue` | `oklch(0.70 0 0)` | metadatos y subtítulos (#9A9A9A) |
| `--color-acorde` | `oklch(0.72 0.14 62)` | **el acorde, y nada más** (#E08A3C) |
| `--color-acento` | `oklch(0.62 0.17 258)` | acción primaria, foco, selección (#3B82F6) |
| `--color-peligro` | `oklch(0.58 0.21 27)` | sin acceso, error (#DC2626) |
| `--color-exito` | `oklch(0.60 0.16 149)` | confirmación (#16A34A) |

**La regla del acorde.** `--color-acorde` es el único cálido del sistema y está reservado a los
acordes y a la tonalidad activa. En cuanto se usa para decorar un ícono o un borde, deja de señalar
lo único que el músico busca a un metro de distancia.

**Se rompió dos veces, y así se detecta** (2026-09-02): el interruptor de acordes y el contador de
`/historial` usaban `text-acorde`, con el mismo valor de color medido que un acorde real. La prueba
es comparar en el navegador `getComputedStyle` de un control contra el de un `.acorde-tocable`: si
dan el mismo color, la regla está rota. Los trece usos legítimos son acordes, diagramas y tonalidad;
cualquier otro es un bug.

Contraste verificado sobre `--color-fondo`: texto 15.5:1, texto tenue 7.4:1, acorde 8.1:1. Todos
por encima de AA; el texto tenue supera 4.5:1 y por eso puede llevar metadatos, no solo adorno.

## Typography

Dos familias, en ejes distintos —una neo-grotesca y una monoespaciada—, nunca dos sans parecidas.

- **Interfaz: Inter.** Neutra, alta legibilidad en tamaños chicos, números tabulares para los
  contadores. Es la sans que el usuario ya lee en todos lados: acá la familiaridad es una virtud.
- **Cifrado: JetBrains Mono.** Monoespaciada de verdad, con ancho de carácter estable en 0.6em, que
  es lo que sostiene la alineación de los acordes sobre la letra. Su altura de x generosa se lee
  mejor de reojo que las mono de sistema.

Ambas se cargan con `next/font` (autoalojadas, sin petición a un tercero en tiempo de ejecución).

Escala **fija en rem**, razón ~1.2. Nada de `clamp()` fluido: es UI de producto, se ve a DPI
constante, y un título que se encoge en un panel se ve peor, no mejor.

| Rol | Tamaño | Peso |
| --- | --- | --- |
| Título de canto | 1.375rem | 600 |
| Título de pantalla | 1.125rem | 600 |
| Momento litúrgico | 0.8125rem | 600, versalita por `font-variant` |
| Cuerpo / fila | 1rem | 450 |
| Metadato | 0.8125rem | 400 |

**El cifrado es la excepción**: su tamaño lo elige el músico (14–24 px, RN-14) y el ajuste al ancho
puede reducirlo para que entren las columnas. Interlineado 1.9, que es lo que deja respirar la
línea de acordes sobre la de letra.

## Layout

- Columna única de 42rem máximo, centrada. No hay barra lateral: no hay a dónde navegar mientras se
  toca.
- **Dos cabeceras distintas, y la de lectura no navega** (2026-09-02). Las pantallas de gestión
  llevan una cabecera de **dos filas**: arriba quién sos y dónde estás —Cantoral, el coro, Salir—,
  abajo los destinos. En una sola fila, a 360 px y con el director, los cinco elementos ocupaban
  344 px con **tres separaciones de 4 px** entre destinos táctiles, y alguien que además fuera admin
  desbordaba. La causa no eran los destinos sino «Cantoral» y el nombre del coro, que se llevaban
  81 px sin ser un lugar a donde ir. Separados, cada destino mide los 40 px que pide *Components*, y
  la fila se desplaza si aparece uno nuevo, en vez de esconder alguno tras un menú.
  La **vista de lectura no lleva esa cabecera**: sólo una barra fija de 44 px con el ← , el canto y
  los dos controles que no son de tocar. Costaba 186 px llegar al primer acorde; ahora 117.
- **Cabecera y barra de control fijas**, contenido entre ellas. La barra de lectura vive abajo,
  donde llega el pulgar.
- Escala de espaciado 4 · 8 · 12 · 16 · 24 · 32 · 48.
- En la vista de lectura el cifrado va **a sangre**, sin tarjeta que lo enmarque: el fondo es el
  papel. Enmarcarlo roba ancho justo donde el ancho decide cuánto se lee.
- Escala de z-index semántica: `--z-barra: 10`, `--z-cabecera: 20`, `--z-modal: 40`. Nunca 999.

## Components

Vocabulario único en toda la aplicación: mismo botón, mismo campo, mismo control táctil.

- **Control táctil**: 44 px de alto mínimo en la vista de lectura, 40 px en pantallas de gestión.
  Borde `--color-borde-fuerte` para llegar a 3:1, fondo `--color-superficie`.
- **Estados obligatorios** en todo interactivo: reposo, hover, **foco visible** (anillo de 2 px en
  `--color-acento` con 2 px de separación), activo, deshabilitado (opacidad 0.4 y `cursor: default`).
- **Fila de canto**: no es una tarjeta. Es una fila de lista con su número del cancionero a la
  izquierda, título, autor debajo y tonalidad a la derecha. Las tarjetas apiladas son la respuesta
  perezosa y acá compiten con el contenido.
- **Estados vacíos**: explican el motivo, nunca "no hay nada". Un vacío por falta de acceso dice
  falta de acceso, y se ve distinto de un vacío legítimo.

## Motion

Producto en flujo: **150–200 ms**, curva `ease-out`. La motion comunica estado —hover, foco,
aparición de la barra— y nada más. No hay secuencias de entrada de página: el músico abre la app
para tocar, no para verla cargar.

El **auto scroll es la excepción declarada**: no es decoración, es la función que el usuario pidió
explícitamente, y por eso no se suprime bajo `prefers-reduced-motion`. Todo lo demás sí: con la
preferencia activa, las transiciones pasan a ser instantáneas.
