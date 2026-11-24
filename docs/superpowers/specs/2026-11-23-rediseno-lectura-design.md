# Rediseño de la lectura y la misa · diseño

**Fecha**: 2026-11-23 · **Estado**: propuesto, pendiente de aprobación del dueño.

## Intención

El dueño usó la app el finde y el veredicto fue claro: **se ve poco y chico, está lenta, el flow no
se entiende y la lectura es difícil de navegar**. Este documento fija el rediseño de esa
experiencia, trabajado con una maqueta navegable de 360 px que el dueño ya recorrió
(`public/maquetas/rediseno-lectura.html`).

La promesa no cambia: «el cancionero de tu coro en el teléfono». Cambia el orden: **la
celebración manda, el lector manda, la biblioteca se aparta**.

## Evidencia que motiva el cambio

Medida sobre la app real y su producción:

- La preferencia del dueño es 22 px, pero el cifrado se renderiza a **17,2 px**: la fórmula de
  ajuste al ancho pisa el tamaño pedido y el control muestra un número que no es el que se lee.
  Con el tamaño de fábrica (16 px) serían ~12,7 px.
- La lista de Canciones monta **~500 filas de entrada** (21.539 px de alto), el muro que se
  siente como lentitud.
- El login de producción tarda **~3 s en 4G con CPU lenta** (TTFB 485 ms, LCP 1,3 s en la
  simulación).

## Decisiones tomadas con el dueño (iteradas sobre la maqueta)

1. **Inicio = la próxima misa** («Hoy»). Dos acciones en una fila: **Empezar** (play) y **La
   misa** (lista), con el contexto en la misma línea.
2. **Todo con íconos, nada de grandes textos.** Empezar, la misa, editar, lecturas, acordes y el
   contexto son íconos. Las instrucciones no se muestran sueltas: viven detrás del **«?»**, que
   abre la hoja «Cómo leer» y se cierra con X.
3. **El contexto, a un toque y colapsable.** Una fila de cuatro íconos —coro, complejidad
   (barras), celebración (estrella) y lugar (pin)— en la misma línea que Empezar/La misa. Tocar
   uno muestra la info en una línea debajo; **se colapsa sola a los 5 segundos** o al volver a
   tocar el mismo ícono.
4. **Tamaño de letra en tres presets, no en número**: **Pequeño (18 px) · Regular (22 px) ·
   Grande (28 px)**, elegido con «Aa» desde el lector o desde Más. Se guarda por persona. Al
   crecer, la letra se reparte en **menos columnas**; nunca se encoge para entrar (sin scroll
   horizontal a 360 px).
5. **La complejidad se calcula, no se guarda** (ver la regla abajo). El ícono de barras muestra
   el nivel y su porqué («Media · 2 de 5 en ensayo»); los cantos en ensayo se marcan en la lista.
6. **El lector es de una tarea**: barra de arriba con volver, título, acordes (nota musical),
   libro (lecturas), lista (cantos de la misa) y «?»; abajo, **cuatro acciones fijas**: anterior,
   Aa, auto-scroll y siguiente. Sin paneles escondidos.
7. **Las lecturas no se muestran en Hoy**: viven dentro de **La misa** (su sección con el libro)
   y en el lector (el mismo libro). Hoy es la misa y nada más.
8. **Misas es el calendario del mes.** Grilla de 7 columnas; cada día con misa lleva fondo y
   marcas chicas: **libro** si tiene lecturas, **punto** si hay propuestas. Arriba, el resumen del
   mes (n misas · n con lecturas · n propuestas). Tocar un día muestra su resumen: celebración,
   lecturas (referencias) y **canciones propuestas** con momento y nota ««texto» — Nombre», o su
   vacío («Sin lecturas cargadas», «Nadie propuso»). Un día sin misa ofrece «Armar misa» al
   director.
9. **La biblioteca es para planificar**: búsqueda y tramos cortos (6 por momento + «Ver el
   resto»), no una pared de 500 filas.
10. **Modo director/cantor**: ícono de persona en la cabecera (sin texto de chip). El modo cantor
    no ve acciones de edición.

## Regla de complejidad (calculada al leer, nunca persistida)

- **Baja**: todas las canciones de la misa ya se ensayaron o ya se cantaron.
- **Media**: hay canciones en ensayo.
- **Alta**: hay canciones nuevas, sin ensayar.

Una, dos o tres barras marcan el nivel. El detalle del ícono dice el porqué («2 de 5 en ensayo»).

### Bordes (mi propuesta, corregible)

- **Una sola canción en ensayo ya es Media** — la regla es «hay al menos una en ensayo», sin
  umbral de cantidad; lo importante es avisar que la misa no está redonda.
- **Una canción en ensayo que ya se cantó antes sigue contando como en ensayo**: manda el estado
  actual de la canción (`cantos.estado`), no su historial; el coro decidió reensayarla por algo.

## Otros puntos abiertos (mi propuesta, corregible)

- **Coro que canta**: hoy es siempre el coro dueño de la misa; el ícono lo muestra. Un coro
  invitado es futuro — no se agrega modelo ahora.
- **Celebración y lugar**: texto libre al armar la misa (como el nombre), sin catálogo. Menos
  datos, cero mantenimiento; un catálogo puede venir después si el director lo pide.

## No objetivos

- No cambia la identidad cálida (tema oscuro/último y claro del DESIGN.md) ni los tokens.
- No se toca el armador de la misa (sigue siendo cantos y tono), salvo lo que pide la regla de
  complejidad y los textos de celebración/lugar.
- No hay service worker ni offline tras cerrar la app (sigue fuera de alcance).
- No se rediseñan perfiles, miembros, historial ni sugerencias más allá de lo listado.

## Lo que queda al builder

- La heurística exacta de complejidad contra `cantos.estado` de las canciones de la misa, y su
  test en un motor puro.
- El arreglo del tamaño real del cifrado (que el px renderizado sea el del preset, con reflow por
  columnas) y la migración del presupuesto 14–32 px a los tres presets por persona.
- El calendario del mes: datos por día (misa, lecturas, propuestas), marcas y detalle; cómo se
  arma una misa desde un día vacío.
- La biblioteca por tramos (6 + «Ver el resto»), hoy parcialmente resuelta con tramos de 100.
- Cómo convive el nuevo «Hoy» con el Inicio actual y la navegación de cuatro destinos.

## Referencia de la maqueta

- Navegable en local: `public/maquetas/rediseno-lectura.html` (dev server `:3002`, o
  `http://10.20.3.148:3002/maquetas/rediseno-lectura.html` en la red).
- Pantallas: Hoy · La misa · Calendario (Misas) · Canciones · Lector de cantos · Lecturas · Más.
