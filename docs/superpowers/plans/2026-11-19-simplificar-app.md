# Simplificar la app · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unificar Canciones, convertir Inicio en tablero (próxima misa, más cantadas, miembros, ensayo) y plegar «Sobre este canto».

**Architecture:** Next.js 16 App Router; sin migraciones. `/repertorio` pasa a tener dos vistas (`?vista=todas`); `/canciones` redirige. Inicio reutiliza las consultas existentes (`repertorioConHistorial`, `fichasDelCoro`, `repertorioPorMomento`). El plegado usa `<details>` nativo. La lista muestra la página; el número queda en la ficha.

**Tech Stack:** React 19, Supabase (RLS), zod, Tailwind 4, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-19-simplificar-app-design.md`

## Global Constraints

- UI y comentarios en español, tuteo; identifiers en español.
- Sin dependencias nuevas, sin shadcn, sin migraciones.
- La RLS sigue mandando; la UI solo no ofrece lo que la RLS rechazaría.
- Controles táctiles de 44 px; nada de scroll horizontal a 360 px.
- Motores puros con test; UI verificada corriendo la app.
- Commits en español, con `Co-Authored-By: Claude Code <noreply@anthropic.com>`.

## Review Focus

- Un número de canto repetido (dos n.º 1) no debe volver a la lista: se muestra página.
- La búsqueda por número sigue funcionando en las dos vistas.
- El arrastre del director solo existe en «Por momento» y sin búsqueda.
- Un músico no ve el bloque Miembros ni «Revisar».
- Un canto sin página deja la columna vacía, sin inventar un número.
- `/canciones` con búsqueda conserva `q` al redirigir.

---

### Task 1: Página en la lista y búsqueda por número

**Files:**
- Modify: `lib/datos/repertorio.ts` (`CantoDeLista`, `repertorioPorMomento`, `catalogoDelCoro`)
- Modify: `lib/motores/catalogo.ts` (`CancionDeCatalogo`, `filtrarCatalogo`)
- Modify: `lib/motores/catalogo.test.ts`
- Modify: `app/repertorio/fila-canto.tsx` (`DatosFila`, columna izquierda)
- Modify: `app/repertorio/page.tsx` (armado de `filas`)
- Modify: `app/canciones/page.tsx` (la página junto al título)

**Interfaces:**
- `CantoDeLista` y `CancionDeCatalogo` ganan `fuentePagina: number | null`; `CancionDeCatalogo` gana `fuenteNumero: number | null`.
- `DatosFila` cambia `numero` por `pagina: number | null`.
- `filtrarCatalogo` busca también por `fuenteNumero`.

- [ ] **Step 1: Test que falla** en `catalogo.test.ts`: una canción con `fuenteNumero: 67` aparece al filtrar `texto: '67'`; una con número 1 no aparece al buscar 67.
- [ ] **Step 2: Run** `npx vitest run lib/motores/catalogo.test.ts` → falla por la propiedad.
- [ ] **Step 3: Implementar** los campos y la búsqueda; en `repertorioPorMomento` y `catalogoDelCoro` seleccionar `fuente_pagina` (y `fuente_numero` en el catálogo); mapear.
- [ ] **Step 4: Fila** `fila-canto.tsx`: la columna izquierda muestra `c.pagina` (vacía si null); el `DatosFila` y `page.tsx` pasan `pagina: c.fuentePagina`. En `/canciones`, mostrar `pág. N` debajo del título cuando exista.
- [ ] **Step 5: Run** tests, `npx tsc --noEmit`, `npm run lint`; verificar en la app que la lista muestra páginas reales y la búsqueda por número sigue.
- [ ] **Step 6: Commit** `feat: la página del cancionero en la lista y búsqueda por número`.

### Task 2: Canciones unificada

**Files:**
- Create: `app/repertorio/atajos.tsx` (chips de sección, server component)
- Create: `app/repertorio/vista-todas.tsx` (contenido de la actual `/canciones` como componente)
- Modify: `app/repertorio/page.tsx` (toggle, vista, chips, `searchParams`)
- Modify: `app/repertorio/repertorio-ordenable.tsx` (id de sección)
- Modify: `app/canciones/page.tsx` (redirect a `/repertorio?vista=todas`)
- Modify: `app/mas/page.tsx` (quitar «Todas las canciones»)
- Test: `lib/motores/catalogo.test.ts` (si toca filtros)

**Interfaces:**
- `/repertorio` acepta `vista?: 'todas'`, `q`, y los filtros actuales (`momento`, `estado`, `partitura`, `repetidas`, `solistas`).
- La vista «Todas» reutiliza `catalogoDelCoro`, `filtrarCatalogo`, `repetidas`, `cantosConPartitura` y `Filtros`.
- Los chips son `<a href="#momento-<codigo>">`; las secciones llevan `id` y `scroll-mt` para el sticky.

- [ ] **Step 1:** Extraer el contenido de `app/canciones/page.tsx` (sin `Cabecera`/`main`) a `VistaTodas`; la página `/canciones` solo redirige conservando `q` y filtros.
- [ ] **Step 2:** En `/repertorio`, leer `searchParams`; si `vista==='todas'`, renderizar `VistaTodas`; si no, la vista por momento actual.
- [ ] **Step 3:** Agregar el conmutador «Por momento / Todas» (dos `Link` con `vista` y `q`) y la fila de chips bajo el buscador, dentro del sticky; chips solo en «Por momento», con las secciones visibles.
- [ ] **Step 4:** Ids `momento-<codigo>` en las secciones de ambas variantes (estática y `RepertorioOrdenable`) y `scroll-mt` para que el título aterrice bajo el sticky; verificar el salto a 360 px.
- [ ] **Step 5:** Quitar la entrada de Más; actualizar enlaces internos a `/canciones` para que no rompan (la redirección los cubre).
- [ ] **Step 6:** Verificar: toggle, chips, filtros de Todas, redirect con `q`, arrastre solo en Por momento, sin overflow. Tests/lint/tsc. Commit `feat: una sola pantalla de Canciones con secciones y filtros`.

### Task 3: Inicio como tablero

**Files:**
- Modify: `app/page.tsx`
- Modify: `lib/datos/historial.ts` (exponer/ordenar si hace falta; ya existe `repertorioConHistorial`)
- Test: `lib/motores/historial.test.ts` (si se agrega un helper puro)

**Interfaces:**
- `repertorioConHistorial(coroId)` + `ordenarPorUso` → top 3 con `veces > 0`, `describirAntiguedad(historial.diasDesdeUltima)`.
- `fichasDelCoro(coroId)` (solo `ver_ficha_del_coro`) → miembros, roles, tesituras.
- `repertorioPorMomento(coroId)` → `enEnsayo` y `listo` distintos; el enlace «Revisar» a `/repertorio?vista=todas&estado=en_ensayo`.

- [ ] **Step 1:** Reescribir Inicio: hero de la próxima misa (anillo, título, Empezar/Ver, participación) y tres bloques: Las más cantadas, Miembros del coro, En ensayo.
- [ ] **Step 2:** Quitar «Para que quede lista», «Voces que van», «Para repasar», «Se está ensayando», «Después» y «También pendiente»; limpiar imports/funciones sin uso (`BarraDeVoces`, `FilaDeAvance`, `Chico`, `FilaChica`).
- [ ] **Step 3:** Permisos: Miembros solo con `ver_ficha_del_coro`; «Revisar» solo con `editar_canto`; el miembro ve los títulos y el enlace a Canciones.
- [ ] **Step 4:** Datos reales: Pescador 4×, Abre tu jardín 3×, Santo Gen Rosso 3×; 3 miembros (2 directores, 1 miembro); 469 en ensayo / 86 listos.
- [ ] **Step 5:** Verificar a 360 px como director y como músico; tests/lint/tsc; commit `feat: Inicio como tablero` .

### Task 4: «Sobre este canto» plegado

**Files:**
- Modify: `app/repertorio/[cantoId]/page.tsx`

**Interfaces:**
- `<details>` cerrado por defecto; `<summary>` con «Sobre este canto» y el resumen (`N correcciones`, «sin estrenar»/`N veces`); la atribución de la fuente adentro.

- [ ] **Step 1:** Mover el párrafo de `fuenteTitulo` dentro del detalle.
- [ ] **Step 2:** Envolver la sección en `<details>` con `<summary>` de 44 px; el resumen dinámico con `versiones` e `historial.veces`; conservar `HistorialDelCanto`, `MarcarQuienCanta`, el enlace de versiones y `Sugerir`.
- [ ] **Step 3:** Estilar el `summary` con los tokens (sin `marker` por defecto); ocultar el triángulo nativo; chevron dibujado; abrir/cerrar con teclado.
- [ ] **Step 4:** Verificar que sin JS abre/cierra, que la fuente se ve al abrir y que el sticky de controles sigue; tests/lint/tsc; commit `feat: plegar Sobre este canto`.

### Task 5: Verificación y cierre

- [ ] `npm test`, `npm run lint`, `npm run build` (dev detenido).
- [ ] Playwright a 360 y 430 px, ambos temas, director y músico: Canciones (chips, toggle, redirect), Inicio (4 bloques, permisos), Canto (plegado), sin overflow ni errores.
- [ ] Commit de docs si quedan; merge a `main` local; producción después del OK (sin cambios de base).
