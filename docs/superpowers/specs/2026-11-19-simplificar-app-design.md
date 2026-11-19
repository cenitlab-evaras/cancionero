# Simplificar la app: Canciones, Inicio y Canto

Fecha: 2026-11-19 · Rama: `main`

## Qué y por qué

El dueño pidió simplificar la app y después un tablero para Inicio. La app ya
está sólida (37/40 en la auditoría del 17 de noviembre); lo que sigue es quitar
duplicaciones y bajar la densidad, no rediseñar el sistema. Las maquetas
aprobadas están en `public/maquetas/simplificacion.html`.

## Alcance

### 1 · Una sola pantalla de Canciones

Hoy hay dos: `/repertorio` (por momento, con repetidos y arrastre del director)
y `/canciones` (una vez cada una, con filtros). Se unifican en `/repertorio`
con un conmutador **Por momento / Todas**:

- **Por momento**: lo de hoy, más una fila de chips pegajosa bajo el buscador
  que salta a cada sección (`#momento-<codigo>`), solo con secciones visibles.
- **Todas**: la tabla y los filtros de `/canciones` dentro de la misma pantalla
  (`?vista=todas`), con el buscador compartido.
- `/canciones` pasa a redirigir a `/repertorio?vista=todas`; se quita la
  entrada «Todas las canciones» de Más. El arrastre y el deslizar del director
  siguen solo en Por momento y sin búsqueda.

### 2 · Inicio como tablero

La portada deja de ser la misa con cuatro listas chicas y pasa a:

- **Próxima misa**: el hero actual (anillo, título, Empezar/Ver, «Vas a esta
  misa»).
- **Las más cantadas**: el top 3 de `repertorioConHistorial` con veces y
  antigüedad; enlace a Historial.
- **Miembros del coro**: cuántos son, roles y tesituras; solo con
  `ver_ficha_del_coro` (director).
- **En ensayo**: cuántos hay, cuántos listos y los primeros títulos; el enlace
  «Revisar» lleva a Canciones → Todas con `estado=en_ensayo` (solo director).
- Salen de Inicio «Para que quede lista», «Voces que van», «Para repasar», «Se
  está ensayando», «Después» y «También pendiente»: eso vive en la misa o en
  Misas. La participación se queda en el hero.

### 3 · El canto termina en el canto

«Sobre este canto» pasa a un `<details>` nativo cerrado por defecto, con una
fila resumen «Sobre este canto · 2 correcciones · sin estrenar». La atribución
de la fuente entra en el detalle. El contenido (historial, tesitura, quién
canta, correcciones y proponer) no cambia.

## Decisiones

- **En la lista va la PÁGINA, no el número de canto.** El número se repite entre
  cancioneros (dos n.º 1) y la página identifica mejor; el n.º queda en la ficha
  y sigue siendo buscable. Si falta la página, la columna queda vacía.
- **Una ruta, dos vistas.** `/repertorio` es la dueña; `/canciones` redirige
  conservando la búsqueda.
- **El tablero es del director y del miembro.** «Más cantadas» y «En ensayo» los
  ven todos; «Miembros» solo el director; «Revisar» solo el director.
- **El plegado es nativo.** `<details>`/`<summary>`: sin JS, con teclado y con
  lector de pantalla. No se inventa un acordeón de cliente.

## Fuera de alcance

- Una cola de revisión con acciones en lote: el enlace «Revisar» usa el filtro
  `en_ensayo` que ya existe.
- Invitaciones, clave única, audio, iconos y las dos instalaciones de Supabase.
- Cambios de RLS o migraciones: todo lo que se necesita ya está en la base.

## Verificación

- `npm test`, `npm run lint`, `npm run build`.
- Playwright a 360 y 430 px, oscuro y claro, como director y como músico:
  - Canciones: chips saltan, «Todas» filtra, `/canciones` redirige, el arrastre
    sigue solo en Por momento.
  - Inicio: los cuatro bloques con datos reales; el miembro no ve Miembros.
  - Canto: la fila resumen, el detalle se abre, la fuente queda adentro.
  - Sin overflow horizontal.
- Deploy a producción después del OK; no hay cambios de base.
