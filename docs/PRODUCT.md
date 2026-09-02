# Product

## Register

product

## Users

Músicos de un coro católico —guitarra, voz, a veces teclado— tocando en misa. El contexto de uso
manda sobre todo lo demás: **de pie, con el instrumento puesto, en la luz baja de una iglesia, con
una mano libre a lo sumo y a veces sin poder mirar la pantalla**. Buena parte del coro es gente
joven de misión; hay al menos una persona que ve poco y necesita letra grande de verdad.

Dos roles: el **músico** lee y toca; el **director** además arma el repertorio y las celebraciones,
casi siempre sentado y con tiempo.

El trabajo a resolver: *encontrar el canto del momento litúrgico que viene, verlo en la tonalidad
que puedo cantar, y tocarlo sin tener que soltar la guitarra para pasar de página.*

## Product Purpose

Reemplazar la carpeta de fotocopias y el PDF del cancionero por algo que el coro comparte.
Hoy el repertorio vive en fotocopias con acordes corregidos a mano en el margen, cada músico
llega con su propia versión, y qué se canta el domingo se coordina por WhatsApp.

Éxito es que un coro toque una misa entera desde el teléfono sin volver al papel — y que la
corrección que hace un músico le llegue a los demás.

## Brand Personality

**Instrumento, no aplicación.** Técnico, denso, silencioso. La interfaz desaparece detrás del
cifrado: en la vista de lectura, todo lo que no es acorde o letra está de más.

Tres palabras: **preciso · sobrio · legible**.

Voz de la interfaz: directa y en español de Chile, sin diminutivos ni entusiasmo de producto. Un
estado vacío explica por qué está vacío. Un error dice qué pasó. Nada celebra nada.

## Anti-references

- **App parroquial genérica.** Azules pastel, cruces decorativas, fotos de archivo, tipografía
  redondeada "amable". El cliché del software religioso.
- **Ultimate Guitar tal como es.** Se copia su patrón de lectura —acorde cálido sobre monoespaciado,
  barra inferior de scroll— y nada de su ruido: publicidad, banners, botones compitiendo.
- **App Android de 2019.** Material genérico, pestañas abajo, acento rojo, sombras por todos lados.
  Es exactamente lo que era OpenChord, el antecedente del que este producto se separa.
- **Dashboard SaaS.** Tarjetas iguales en grilla, métricas grandes, gradientes, barra lateral. Un
  cancionero no es un panel de control.

## Design Principles

1. **El cifrado es el producto.** Cada píxel que no sea acorde o letra tiene que justificar su
   existencia en la vista de lectura. Marcos, sombras y tarjetas se quitan salvo que separen algo
   que de verdad se confunde.
2. **Diseñar para la mano ocupada.** Objetivos táctiles grandes, controles al alcance del pulgar,
   nada que exija precisión. Si hace falta apuntar, está mal.
3. **Poca luz, alto contraste.** El tema oscuro no es estética: es la iglesia a las ocho de la
   tarde. La letra tiene que leerse a un metro de distancia y de reojo.
4. **La estructura es la del cancionero.** El coro piensa en momentos litúrgicos —Entrada, Perdón,
   Gloria, Comunión—, no en categorías. La pantalla se organiza como el libro que ya conocen.
5. **Cada número muestra de dónde salió.** El cifrado declara su cancionero y su página. Es
   respeto por la fuente y es lo que permite corregir a oído sin discutir.

## Accessibility & Inclusion

- **WCAG 2.1 AA como piso**: 4.5:1 en texto normal, 3:1 en texto grande y en los bordes de los
  controles.
- **Hay gente en el coro que ve poco.** El tamaño de letra no es un ajuste secundario escondido en
  preferencias: es un control de primera clase en la barra de lectura, y su efecto tiene que
  notarse de verdad en un teléfono angosto.
- **Objetivo táctil mínimo de 44 px** en toda la vista de lectura, sin excepción.
- **`prefers-reduced-motion`**: toda transición tiene su alternativa. El auto scroll es una función
  pedida explícitamente por el usuario, no una animación, y por eso no se suprime — pero nada más
  se mueve solo.
- La aplicación es en español. No hay traducciones y no se fingen.
