---
name: pdf-a-cantoral
description: "Convierte un PDF de cifrados en cantos listos para importar a Cantoral. Entra un PDF cualquiera —el cancionero de dos columnas del coro, una hoja suelta, un cifrado bajado de internet, un escaneo— y sale un JSON de cantos en ChordPro americano que `npm run importar:archivo` mete en el repertorio. Usa PRIMERO los motores deterministas que ya existen (dos-columnas, desdeElCancionero, latinaAAmericana, validarCanto) y solo pone criterio donde esos no llegan. Usar SIEMPRE que aparezca un PDF, una foto o un texto de cifrados que haya que meter al repertorio: 'súbeme este PDF al cancionero', 'convertí esta hoja', 'agregá estos cantos', 'este cifrado está en latina', 'el importador no pudo con este', 'formateá esto para la app'. NO pone un modelo dentro del producto —§16 lo veta— ni sube el PDF a ningún servidor: el criterio lo pone quien corre el skill, fuera de la app, y lo que viaja es texto."
---

# De un PDF a cantos de Cantoral

El importador de H16 lee **un** formato: el cancionero de dos columnas del coro, con su índice.
Con ese acierta y es gratis. Cualquier otra cosa —una hoja suelta, un cifrado de internet, un
escaneo, un PDF a una columna— lo deja afuera, y hoy esos cantos se cargan a mano uno por uno.

Este skill cubre ese hueco: **convierte lo que sea a ChordPro americano, con la fuente declarada,
listo para importar.** Lo que no puede resolver lo dice; nunca lo inventa.

## Dónde vive esto, y por qué no está en la app

`docs/PRD.md` §16 veta la IA dentro del producto: *«ni carpeta, ni cliente de modelo, ni clave en
el ejemplo de entorno»*. Convertir un PDF cualquiera pide criterio, así que el criterio se pone
**acá afuera** y la app sigue recibiendo solo texto ChordPro, como siempre.

Y el PDF **no se sube a ningún lado**: son obras de terceros (§18-1), el repositorio es público, y
el producto acaba de cerrarse como «no guarda ni un solo binario» (§16, al descartar B6/B7). Se lee
del disco, se convierte, y lo que viaja es el cifrado.

## El bucle

| # | Paso | Qué se rompe si te lo saltás |
| --- | --- | --- |
| 1 | **Extraer el texto** con `pdftotext -layout` | Sin `-layout` se pierde la alineación, que es la única pista de dónde va cada acorde |
| 2 | **Probar el camino determinista primero** | Escribís a mano lo que un motor probado ya hace exacto y gratis |
| 3 | **Poner criterio solo donde el motor no llega** | — |
| 4 | **Decidir momento, autor y fuente de cada canto** | El canto entra sin momento y no aparece en ningún grupo del repertorio |
| 5 | **Escribir el JSON y correr el import en seco** | Metés noventa cantos en una base con datos sin haberlos mirado |
| 6 | **Revisar la salida, aplicar, y verificar en la app** | Crees que está bien porque el script no dio error |

### 1 · Extraer el texto

```bash
pdftotext -layout "ruta/al/archivo.pdf" - | less
```

**Si sale vacío o casi vacío, el PDF es un escaneo**: no tiene texto, tiene imágenes. Ahí se leen
las páginas como imágenes (`Read` sobre el PDF con el rango de páginas) y se transcribe mirando.
Es más lento y más frágil: transcribí **menos cantos por vez** y revisá cada uno.

### 2 · El camino determinista, que es el que hay que intentar primero

**Las rutas de acá son relativas a la raíz del repositorio, que es la carpeta `app/`.** Los PDF
viven FUERA del repo, un nivel más arriba (`../docs/cancioneros catolicos/`): son de terceros y esto
es público (§18-1).

En `lib/motores/` hay cuatro motores con test que ya resuelven la mayor parte. Antes de
escribir un solo acorde a mano, probá cuál aplica:

| Si el texto viene así | Usá | Qué hace |
| --- | --- | --- |
| Dos columnas: letra a la izquierda, acordes a la derecha | `aAcordesSobreLetra(textoPagina)` de `dos-columnas.ts` | Detecta la columna de corte **por página** y devuelve el formato de líneas alternadas |
| Acordes en una línea, letra en la de abajo | `desdeElCancionero(texto)` de `acordes-sobre-letra.ts` | Convierte a ChordPro **conservando la columna de cada acorde** |
| Acordes en notación latina (DO, RE, MI, LA7, sim, fa#m) | `latinaAAmericana(acorde)` de `notacion-latina.ts` | Traduce a americana. `desdeElCancionero` ya lo aplica |
| Ya está en ChordPro | nada | Pasa intacto; `desdeElCancionero` lo detecta y no lo toca |

**Cómo probarlos sin levantar la app:**

```bash
node --experimental-strip-types --input-type=module-typescript -e "
import { desdeElCancionero } from './lib/motores/acordes-sobre-letra.ts'
console.log(desdeElCancionero(\`LA        RE       MI
Grande es el cariño para con tus hijos\`))
"
```

### 3 · Dónde poner criterio, y dónde no

**Sí:** decidir qué bloque de texto es un canto y dónde termina; separar título de subtítulo;
reconocer estribillos; descartar índices, portadas y números de página; resolver una columna que el
detector no pudo; corregir un acorde que el OCR leyó mal (`R E` → `RE`, `Sim` → `sim`).

**No, nunca:**

- **No inventes acordes.** Si una estrofa no los trae en la fuente, va sin acordes. El coro los
  corrige a oído; una invención se propaga a todos y nadie sabe de dónde salió.
- **No inventes letra.** Si una línea del escaneo no se lee, se marca en `revisar` y se deja el
  hueco. Un verso plausible es peor que un verso faltante: nadie lo va a auditar.
- **No "mejores" el cifrado.** Ni simplificar acordes, ni cambiar de tonalidad, ni quitar
  repetidos. Cantoral transpone al leer (H3) y el cifrado guardado no cambia nunca (decisión 10).

### 4 · Momento, autor y fuente

| Campo | Cómo se llena |
| --- | --- |
| `momento` | El **código**, no el nombre: `entrada` · `perdon` · `gloria` · `salmo` · `antifona` · `ofertorio` · `santo` · `cordero` · `comunion` · `maria` · `himno`. Si el PDF no lo dice, se deduce de la letra — y **se marca en `revisar`** que fue una deducción |
| `autor` | Solo si el PDF lo declara. En estos cancioneros la mayoría es anónima o comunitaria: inventar un autor rompe RN-03, que distingue versiones por autor |
| `fuenteTitulo` | El nombre del cancionero u origen. **§PRODUCT lo exige**: *«cada número muestra de dónde salió»* — es lo que permite corregir a oído sin discutir |
| `fuenteNumero` · `fuentePagina` | Si el original los tiene. Es como el coro busca de memoria |
| `revisar` | Todo lo que quedó decidido a ojo. **Se llena generosamente**: el importador lo lista aparte y el director lo mira |

### 5 · El archivo

Un array JSON. `titulo`, `cifrado` y `momento` son obligatorios; el resto, opcional.

```json
[
  {
    "titulo": "Alma misionera",
    "cifrado": "[E]Señor, toma mi [B]vida nueva\n[A]antes de que la es[E]pera",
    "momento": "comunion",
    "autor": null,
    "fuenteTitulo": "Hoja suelta del coro",
    "fuenteNumero": null,
    "fuentePagina": null,
    "revisar": "El momento se dedujo de la letra: el PDF no lo declara"
  }
]
```

Guardalo **fuera del repositorio** (el scratchpad sirve) si el PDF es de terceros.

```bash
npm run importar:archivo -- /ruta/cantos.json            # en seco, no escribe
npm run importar:archivo -- /ruta/cantos.json --aplicar
```

### 6 · Verificar

El script valida con `validarCanto` —el mismo motor que el formulario del director— y **nunca pisa
un canto existente**. Los importados entran **`en_ensayo`**: nadie del coro los revisó todavía, y
H10 existe para poder decirlo.

Después del `--aplicar`, **abrí dos o tres en la app**: que los acordes se rendericen y sean
pulsables, que la transposición funcione, y que a 360 px no haya scroll horizontal. Compilar no
alcanza; ver el canto en pantalla, sí.

## Los innegociables

1. **La regla del acorde.** El acorde va sobre la sílaba donde cambia, no al principio de la línea.
   Es la razón de existir de la vista de lectura (§PRODUCT, DESIGN). Si la fuente no da la posición,
   se reparte sobre el inicio de las palabras —lo que hace `repartirSobreLetra`— y **se dice** que
   es aproximado.
2. **Notación americana.** El cifrado guardado es americano (decisión 3). La latina se convierte al
   entrar, no se guarda.
3. **Cada canto declara su fuente.** Sin `fuenteTitulo`, el canto pierde el respaldo que permite
   corregirlo sin discutir.
4. **Nunca se pisa un canto existente.** Los curados a mano tienen la columna de cada acorde
   ajustada; nada automático la mejora.
5. **Lo dudoso se marca, no se calla.** `revisar` es parte del entregable, no una excusa.
6. **El PDF no entra al repositorio ni a ningún servidor.**

## Qué NO hace este skill

- **No pone un modelo dentro de la app.** §16 lo veta y esta es la alternativa que lo respeta.
- **No sube ni guarda el PDF.**
- **No decide el alcance del repertorio.** Qué cantos entran al coro lo decide el director.
- **No reemplaza a `importar:cancionero`.** Para el cancionero de dos columnas con índice, ese es
  más barato y más exacto: úsalo primero y traé acá solo lo que dejó afuera.
