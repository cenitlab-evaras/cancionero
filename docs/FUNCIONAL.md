# Análisis Funcional — OpenChord v0.5.1

Documento de análisis funcional de la aplicación **OpenChord**, elaborado por ingeniería inversa del código fuente de este repositorio. Describe *qué hace* el sistema, *para quién*, *bajo qué reglas* y *con qué límites*.

---

## 1. Propósito y alcance

### 1.1 Problema que resuelve
El músico que toca con cifrados (acordes sobre letra) depende de carpetas de papel o de PDF sueltos: no puede transponer a otra tonalidad sin reescribir, no puede pasar página con las manos ocupadas y no tiene su repertorio organizado por presentación.

### 1.2 Objetivo del sistema
Permitir a un músico **almacenar, organizar, adaptar y leer** su repertorio de cifrados en un teléfono o tablet, sin necesidad de conexión permanente ni de cuenta de usuario.

### 1.3 Alcance funcional

**Dentro del alcance**
- Catálogo local de canciones, artistas y listas de reproducción.
- Lectura asistida: transposición, tamaño de letra, auto scroll, pasar página táctil, diagramas de acordes.
- Creación y edición de cifrados en dos formatos.
- Descarga de cifrados desde un servicio externo.
- Copia de seguridad, exportación e importación de datos en archivo.
- Interfaz en inglés y portugués de Brasil.

**Fuera del alcance**
- Cuentas de usuario, sincronización en la nube o colaboración multiusuario.
- Reproducción de audio, metrónomo o pistas de acompañamiento.
- Edición de partitura tradicional o notación de pentagrama.
- Diagramas para instrumentos distintos de la guitarra.
- Búsqueda online en iOS (limitación asumida, ver RF-13).

---

## 2. Actores

| Actor | Tipo | Interacción |
|:--|:--|:--|
| **Músico** | Humano, único rol del sistema | Usa todas las funcionalidades. No hay perfiles ni permisos diferenciados. |
| **Servicio de cifrados** (CifraLivre / OpenChordApi) | Sistema externo | Provee búsqueda de artistas y canciones y el contenido en formato ChordPro. |
| **Sistema operativo del dispositivo** | Sistema externo | Almacenamiento de archivos, selector de documentos, menú de compartir, permisos. |

No existe rol de administrador. Todo dato es propiedad exclusiva del dispositivo.

---

## 3. Requisitos funcionales

### 3.1 Gestión del repertorio

| ID | Requisito | Detalle |
|:--|:--|:--|
| **RF-01** | Listar canciones | Listado alfabético por título, con artista como subtítulo. |
| **RF-02** | Buscar canciones guardadas | Búsqueda incremental que coincide por **título o nombre de artista**, sin distinguir mayúsculas ni acentos de caja. |
| **RF-03** | Crear canción | Alta manual indicando título, artista y contenido. |
| **RF-04** | Editar canción | Modificación de título, artista y contenido de una canción existente. |
| **RF-05** | Eliminar canción | Con diálogo de confirmación previo. |
| **RF-06** | Listar artistas | Listado alfabético; al abrir un artista se ven sus canciones. |
| **RF-07** | Eliminar artista | Elimina en cascada todas sus canciones (acción destructiva, requiere confirmación). |
| **RF-08** | Navegar de canción a artista | Desde el listado y desde la vista de lectura (pulsando el nombre del artista). |

### 3.2 Listas de reproducción

| ID | Requisito | Detalle |
|:--|:--|:--|
| **RF-09** | Crear, renombrar y eliminar listas | El nombre es obligatorio y único. |
| **RF-10** | Añadir y quitar canciones de una lista | Desde la propia lista o desde el menú de la vista de lectura. |
| **RF-11** | Ordenar una lista | Por título, por artista (ambos ascendente o descendente) o en **orden personalizado** mediante arrastre. |
| **RF-12** | Compartir una lista | Genera un archivo `.openchord` con la lista y todas sus canciones y lo entrega al menú de compartir del sistema. |

### 3.3 Obtención de cifrados desde internet

| ID | Requisito | Detalle |
|:--|:--|:--|
| **RF-13** | Buscar cifrados online | Consulta al servicio externo por texto libre. Los resultados mezclan artistas y canciones. **Disponible solo en Android**; en iOS se muestra un mensaje y se ofrece la creación manual. |
| **RF-14** | Explorar canciones de un artista online | Al seleccionar un artista del resultado, se listan sus canciones disponibles. |
| **RF-15** | Previsualizar antes de guardar | La canción se muestra renderizada antes de decidir guardarla localmente. |
| **RF-16** | Guardar canción descargada | Se almacena en el catálogo local, creando el artista si no existía. |

### 3.4 Lectura y ejecución

| ID | Requisito | Detalle |
|:--|:--|:--|
| **RF-17** | Renderizar cifrado | Acordes posicionados sobre la sílaba correspondiente de la letra, con ajuste de línea al ancho del dispositivo. |
| **RF-18** | Transponer | Subir o bajar de a un semitono. El rango recorre ±12 y vuelve a 0 al completarse la octava. |
| **RF-19** | Ajustar tamaño de letra en lectura | Entre 14 y 24, en pasos de 2. |
| **RF-20** | Mostrar u ocultar tablaturas | Interruptor por canción; al ocultarlas, los bloques de tablatura desaparecen del renderizado. |
| **RF-21** | Auto scroll | Desplazamiento continuo con control de reproducción/pausa y slider de velocidad continuo. |
| **RF-22** | Pasar página táctil (*page turner*) | Dos zonas táctiles invisibles: mitad inferior avanza ~70 % de pantalla, mitad superior retrocede ~80 %. Al activarse muestra brevemente un indicador visual. |
| **RF-23** | Consultar diagrama de acorde | Al pulsar un acorde del cifrado se abre una barra con su diagrama de guitarra y el de todos los demás acordes de la canción, desplazable y centrada en el pulsado. |
| **RF-24** | Recordar preferencias por canción | Transposición, tamaño de letra y visibilidad de tablaturas se guardan por canción y se restauran al reabrirla. |

### 3.5 Edición de contenido

| ID | Requisito | Detalle |
|:--|:--|:--|
| **RF-25** | Editar en formato ChordPro | Acordes entre corchetes en línea: `U[C]sing the [Dm]chordPro format[G]`. |
| **RF-26** | Editar en formato "acordes sobre letra" | Acordes escritos en una línea superior alineados con la letra. |
| **RF-27** | Convertir entre formatos | El cambio de pestaña convierte el contenido automáticamente, sin pérdida de acordes. El almacenamiento interno es siempre ChordPro. |
| **RF-28** | Gestionar metaetiquetas | Las etiquetas de título y artista se ocultan al editar y se regeneran a partir de los campos del formulario al renderizar. |

### 3.6 Datos y configuración

| ID | Requisito | Detalle |
|:--|:--|:--|
| **RF-29** | Crear copia de seguridad | Exporta todas las canciones y listas a un archivo `backup-AAAA_MM_DD.openchord`. En Android lo guarda en Descargas informando la ruta; en iOS abre el diálogo de compartir. |
| **RF-30** | Importar datos | Selección de archivo mediante el selector de documentos del sistema, con validación estructural previa. |
| **RF-31** | Seleccionar idioma | Inglés y portugués de Brasil, mostrando nombre nativo y nombre en inglés. |
| **RF-32** | Definir tamaño de letra por defecto | Con previsualización en vivo sobre una canción de ejemplo. |
| **RF-33** | Definir valores por defecto de lectura | Tablaturas visibles u ocultas; page turner activado o desactivado. |

---

## 4. Reglas de negocio

| ID | Regla | Consecuencia observable |
|:--|:--|:--|
| **RN-01** | El título y el contenido de una canción no pueden estar vacíos. | El guardado se bloquea con mensaje de error específico por campo. |
| **RN-02** | El artista de una canción es obligatorio. | Ídem. |
| **RN-03** | No se admiten dos canciones con el mismo título del mismo artista. | El alta duplicada no crea un registro nuevo. *(Limitación conocida: impide guardar dos versiones distintas de la misma canción.)* |
| **RN-04** | El nombre de artista es único en el sistema. | Al crear o editar una canción, un artista existente se reutiliza en lugar de duplicarse. |
| **RN-05** | Un artista sin canciones no debe permanecer en el catálogo. | Al borrar la última canción de un artista, el artista se elimina automáticamente. |
| **RN-06** | Eliminar un artista elimina sus canciones. | Acción en cascada. |
| **RN-07** | El nombre de una lista de reproducción es único. | Crear o renombrar con un nombre existente devuelve error. |
| **RN-08** | Una canción puede pertenecer a varias listas. | Sin límite de pertenencia. |
| **RN-09** | Al importar, una canción existente solo se sobrescribe si el archivo trae una versión más reciente. | Comparación por fecha de modificación; nunca se pierde trabajo más nuevo del dispositivo. |
| **RN-10** | Al importar, artistas y listas se identifican **por nombre**; las canciones, **por identificador**. | Importar dos veces el mismo archivo no duplica listas ni artistas. |
| **RN-11** | Un archivo de importación con estructura inválida se rechaza íntegramente. | Validación previa; la base de datos no se modifica parcialmente. |
| **RN-12** | Auto scroll y page turner son mutuamente excluyentes. | Activar el page turner detiene el auto scroll y viceversa. |
| **RN-13** | La transposición recorre un ciclo de octava. | Al alcanzar +12 o −12 el valor vuelve a 0 (misma tonalidad sonora). |
| **RN-14** | El tamaño de letra está acotado entre 14 y 24, en pasos de 2. | Los controles no permiten salir del rango. |
| **RN-15** | Las preferencias de una canción prevalecen sobre las globales. | Los valores globales solo aplican a canciones que aún no tienen preferencia propia. |
| **RN-16** | Los acordes contenidos dentro de comentarios también se transponen. | Un `{comment: ...}` con acordes se mantiene coherente con la tonalidad elegida. |

---

## 5. Casos de uso principales

### CU-01 — Preparar una canción para tocarla en otra tonalidad
**Actor:** Músico · **Precondición:** la canción está en el catálogo.
1. Abre la canción desde el listado, el artista o una lista.
2. Abre el menú de herramientas.
3. Pulsa `+` o `−` hasta alcanzar la tonalidad deseada; el cifrado se recalcula en cada pulsación.
4. Cierra el menú y toca.

**Postcondición:** la transposición queda guardada; al reabrir la canción aparece ya transpuesta (RF-24, RN-13).

### CU-02 — Tocar sin manos libres
**Actor:** Músico · **Precondición:** canción abierta.
- **Alternativa A (auto scroll):** abre el menú → *Auto scroll* → pulsa reproducir y regula la velocidad con el slider hasta que el avance acompañe la ejecución.
- **Alternativa B (page turner):** activa *Page turner*; a partir de ese momento tocar la mitad inferior de la pantalla avanza y la superior retrocede.

**Regla aplicable:** activar una modalidad desactiva la otra (RN-12).

### CU-03 — Incorporar una canción desde internet
**Actor:** Músico · **Precondición:** dispositivo Android con conexión.
1. Pestaña de búsqueda online → escribe artista o título → confirma.
2. Elige un resultado: si es artista, se listan sus canciones; si es canción, se abre la previsualización.
3. Revisa el cifrado renderizado y lo guarda.

**Postcondición:** canción disponible sin conexión; artista creado si no existía (RF-16, RN-04).
**Flujo alternativo (iOS):** la pestaña informa que la función no está disponible y ofrece crear la canción manualmente (CU-04).

### CU-04 — Cargar un cifrado propio
**Actor:** Músico.
1. Desde el listado de canciones pulsa añadir.
2. Escribe título y artista.
3. Elige la pestaña del formato en el que tiene el cifrado (ChordPro o acordes sobre letra) y pega o escribe el contenido.
4. Puede alternar de pestaña para verlo convertido al otro formato.
5. Guarda; la app abre directamente la vista de lectura.

**Excepciones:** campos vacíos bloquean el guardado con mensaje específico (RN-01, RN-02).

### CU-05 — Armar el repertorio de una presentación
**Actor:** Músico.
1. Crea una lista con el nombre del evento.
2. Añade canciones desde la propia lista o desde cada canción abierta.
3. Entra en la edición de la lista y arrastra las canciones al orden en que se van a tocar.
4. Opcionalmente comparte la lista con otro músico, que la recibe como archivo e importa.

**Postcondición:** el receptor obtiene la lista **y** las canciones que contiene, fusionadas con su propio catálogo sin duplicar (RF-12, RN-09, RN-10).

### CU-06 — Resguardar y restaurar el repertorio
**Actor:** Músico.
1. Ajustes → *Crear copia de seguridad*. En Android concede el permiso de escritura si se le solicita; la app informa la ruta del archivo. En iOS elige dónde compartirlo.
2. Para restaurar: Ajustes → *Importar* → selecciona el archivo.

**Excepciones:** archivo con formato inválido → mensaje de error y ninguna modificación en los datos (RN-11). Permiso denegado en Android → la exportación se cancela con aviso.

---

## 6. Modelo conceptual de datos

```
Artist 1 ──< N Song >── N Playlist
                  (una canción puede estar en varias listas)

GlobalSettings (registro único de preferencias)
```

| Entidad | Atributos funcionales |
|:--|:--|
| **Canción** | Título, artista, contenido del cifrado, transposición recordada, tamaño de letra recordado, visibilidad de tablaturas, fecha de modificación. |
| **Artista** | Nombre (único). |
| **Lista de reproducción** | Nombre (único), colección ordenada de canciones. |
| **Preferencias globales** | Idioma, tamaño de letra por defecto, tablaturas por defecto, page turner por defecto. |

**Valores por defecto:** idioma inglés, tamaño de letra 14, tablaturas visibles, page turner desactivado.

### Formato de intercambio `.openchord`
Archivo JSON versionado que contiene canciones (con su contenido íntegro y sus preferencias) y listas (con las referencias a las canciones incluidas). Es la única vía de intercambio de datos entre dispositivos.

---

## 7. Restricciones y requisitos no funcionales

| Ámbito | Definición |
|:--|:--|
| **Plataformas** | Android e iOS, aplicación nativa multiplataforma. |
| **Conectividad** | Todo el uso principal funciona **sin conexión**. Solo la búsqueda e importación online requieren internet. |
| **Persistencia** | Base de datos embebida en el dispositivo. Sin servidor propio ni respaldo automático: la copia de seguridad es una acción explícita del usuario. |
| **Privacidad** | No se recogen datos personales ni se requiere registro. La única salida de datos es la que el usuario provoca al compartir o exportar. |
| **Dependencia externa** | El servicio de cifrados es de terceros y está declarado en estado BETA: puede estar caído o devolver resultados incompletos. La aplicación debe seguir siendo plenamente utilizable con el catálogo local. |
| **Permisos** | Android solicita escritura en almacenamiento externo únicamente al exportar. |
| **Internacionalización** | Interfaz traducible por catálogo de cadenas; actualmente inglés y portugués de Brasil. |
| **Licencia** | GNU GPL v3 (software libre). |

---

## 8. Limitaciones conocidas y funcionalidades pendientes

### 8.1 Limitaciones actuales
- **Búsqueda online no disponible en iOS.**
- **No se admiten dos versiones de la misma canción** del mismo artista (RN-03).
- **Renombrar un artista hacia un nombre ya existente no fusiona** los repertorios: la operación se descarta silenciosamente.
- Diagramas de acordes **solo para guitarra en afinación estándar** (E-A-D-G-B-E); no hay cejillas dibujadas ni digitaciones alternativas seleccionables.
- Un único proveedor de cifrados configurado, aunque la arquitectura admite añadir más.
- Sin sincronización entre dispositivos: el intercambio es manual por archivo.

### 8.2 Pendientes declarados por el proyecto
| Funcionalidad | Estado |
|:--|:--:|
| Deslizar con el toque | 🕑 |
| Pasar página con el botón de volumen | 🕑 |
| Visualización en múltiples columnas | 🕑 |
| Diccionario de acordes | 🕑 |
| Modo presentación para listas de reproducción | 🕑 |

---

## 9. Matriz de trazabilidad — requisito ↔ implementación

| Requisito | Componente principal |
|:--|:--|
| RF-01, RF-02, RF-05 | [app/containers/SongList.tsx](app/containers/SongList.tsx), [app/db/Song.ts](app/db/Song.ts) |
| RF-03, RF-04, RF-25 a RF-28 | [app/containers/SongEdit.tsx](app/containers/SongEdit.tsx) |
| RF-06, RF-07, RF-08 | [app/containers/ArtistList.tsx](app/containers/ArtistList.tsx), [app/containers/ArtistView.tsx](app/containers/ArtistView.tsx), [app/db/Artist.ts](app/db/Artist.ts) |
| RF-09 a RF-12 | [app/containers/PlaylistList/index.tsx](app/containers/PlaylistList/index.tsx), [app/containers/PlaylistEdit/index.tsx](app/containers/PlaylistEdit/index.tsx), [app/db/Playlist.ts](app/db/Playlist.ts) |
| RF-13 a RF-16 | [app/containers/OnlineSearch.tsx](app/containers/OnlineSearch.tsx), [app/containers/SongPreview.tsx](app/containers/SongPreview.tsx), [app/services/](app/services/) |
| RF-17, RF-18, RN-16 | [app/components/SongTransformer.tsx](app/components/SongTransformer.tsx), [app/utils/CustomHtmlDivFormatter.ts](app/utils/CustomHtmlDivFormatter.ts) |
| RF-19 a RF-22, RF-24 | [app/containers/SongView/index.tsx](app/containers/SongView/index.tsx), [app/components/SongRender.tsx](app/components/SongRender.tsx), [app/components/AutoScrollSlider.tsx](app/components/AutoScrollSlider.tsx), [app/containers/SongView/components/PageTurner.tsx](app/containers/SongView/components/PageTurner.tsx) |
| RF-23 | [app/components/ChordTab.tsx](app/components/ChordTab.tsx), [app/components/ChordChart.tsx](app/components/ChordChart.tsx), [app/assets/chords/guitar.json](app/assets/chords/guitar.json) |
| RF-29 a RF-31, RN-09 a RN-11 | [app/containers/Settings/index.tsx](app/containers/Settings/index.tsx), [app/db/bundler.ts](app/db/bundler.ts) |
| RF-32, RF-33 | [app/containers/Settings/FontSizeSelect.tsx](app/containers/Settings/FontSizeSelect.tsx), [app/db/GlobalSettings.ts](app/db/GlobalSettings.ts) |

---

## Anexo A — Soporte tecnológico

Resumen de las tecnologías que sostienen cada capacidad funcional.

| Capacidad funcional | Tecnología |
|:--|:--|
| Aplicación única para Android e iOS | React Native 0.60 + TypeScript |
| Navegación entre pestañas y pantallas | React Navigation 5 |
| Catálogo persistente sin conexión | Realm 6 (base de datos embebida, esquema v8) |
| Parseo de ChordPro y transposición | ChordSheetJS 2.9 + chordjs |
| Acordes posicionados sobre la letra | Formateador HTML propio renderizado en WebView |
| Diagramas de acordes | react-native-svg |
| Auto scroll y pasar página | JavaScript inyectado en el WebView (`scrollBy`) |
| Backup, importación y compartir | react-native-fs, react-native-document-picker, react-native-share |
| Validación del archivo importado | Decodificador tipado `@artutra/ts-data-json` |
| Búsqueda online | axios sobre la API de CifraLivre |
| Reordenamiento por arrastre | react-native-draggable-flatlist |

**Cobertura de pruebas existente** ([__tests__/](__tests__/)): transformación de canciones, formateador HTML propio y empaquetado/importación de datos.

**Ejecución:** `npm install`, luego `npm run build:android` o `npm run build:ios`; `npm test` para las pruebas.
