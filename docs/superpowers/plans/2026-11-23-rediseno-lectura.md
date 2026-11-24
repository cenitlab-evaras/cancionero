# Rediseño de la lectura y la misa — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehacer la experiencia de lectura de Cantoral: Inicio como «Hoy» con la próxima misa y su contexto en íconos, lector con barra fija de cuatro acciones y letra a tres presets reales, Misas como calendario del mes con lecturas y propuestas, y biblioteca por tramos cortos.

**Architecture:** Seis motores puros sostienen las reglas nuevas (complejidad calculada, presets de letra, ancho de cifrado); la UI cambia en `app/page.tsx` (Hoy), `app/misas/page.tsx` (calendario), `app/misas/[id]` y `app/misas/[id]/[filaId]` (contexto y lector), y `app/repertorio` (lectura y tramos). Dos columnas nuevas en `misas` (`celebracion`, `lugar`), sin tabla nueva ni políticas nuevas. La identidad cálida y los tokens de DESIGN.md no cambian.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind 4, Supabase, vitest, zod.

**Spec:** `docs/superpowers/specs/2026-11-23-rediseno-lectura-design.md`

## Global Constraints

- Motores puros en `lib/motores/` con `.test.ts` al lado (vitest, TDD); sin Supabase, sin red, sin reloj.
- Los presets de letra son exactamente **Pequeño 18 px · Regular 22 px · Grande 28 px**; el px renderizado es el del preset, nunca menor.
- Complejidad: **baja** = sin cantos en ensayo; **media** = hay en ensayo (aunque ya se hayan cantado); **alta** = hay en ensayo sin cantar nunca.
- Todo en español, tuteo, tokens de `app/globals.css`, 44 px táctiles, sin scroll horizontal a 360 px.
- Cero valores derivados persistidos: complejidad y marcas del calendario se calculan al leer.
- RLS activa en la misma migración que crea columnas nuevas; sin cambios de políticas.
- El «modo cantor» de la maqueta NO es un switch nuevo: ya lo hacen los permisos (un miembro no ve acciones de edición). No se agrega toggle.
- `preferencias_perfil.tamano_letra` guarda solo 18 | 22 | 28 de acá en más; los valores viejos (14–32) se normalizan al leer.

## Review Focus

- **La letra nunca se achica por debajo del preset**: con Grande (28 px) a 360 px el texto se parte en más líneas y el px renderizado sigue siendo 28. Test en la tarea 3.
- **Un canto en dos momentos no infla la complejidad**: `enEnsayo` y `sinCantar` cuentan por id, no por fila. Test en la tarea 1.
- **Un mes sin misas no rompe el calendario**: grilla completa, resumen en ceros y detalle «Sin misa este día» con «Armar misa» solo para el director. Verificación en la tarea 5.
- **Hoy sin misa próxima o sin fecha sigue usable**: la pantalla muestra el estado sin misa y no ofrece «Empezar». Verificación en la tarea 6.
- **El contexto se colapsa sin robar el foco ni el scroll**: la línea de info aparece debajo, se cierra sola a los 5 s y no empuja el contenido lateralmente a 360 px. Verificación en la tarea 6.
- **La migración no toca datos existentes**: `celebracion`/`lugar` nacen NULL y las misas viejas se ven igual; RLS local sigue 97/97. Verificación en la tarea 4.

---

### Task 1: Motor de complejidad de la misa

**Files:**
- Create: `lib/motores/complejidad.ts`
- Test: `lib/motores/complejidad.test.ts`

**Interfaces:**
- Consumes: `EstadoCanto` de `lib/motores/estado-canto`.
- Produces: `nivelDeComplejidad(cantos: { id: string; estado: EstadoCanto; veces: number }[]): { nivel: 'baja' | 'media' | 'alta'; enEnsayo: number; sinCantar: number }` — `enEnsayo`: cantos DISTINTOS con `estado === 'en_ensayo'`; `sinCantar`: de esos, los que tienen `veces === 0`; `nivel`: `'alta'` si `sinCantar > 0`, si no `'media'` si `enEnsayo > 0`, si no `'baja'`.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
import { describe, expect, test } from 'vitest'
import { nivelDeComplejidad } from './complejidad'

describe('nivelDeComplejidad', () => {
  test('todo listo es baja', () => {
    const r = nivelDeComplejidad([
      { id: 'a', estado: 'listo', veces: 12 },
      { id: 'b', estado: 'listo', veces: 0 },
    ])
    expect(r).toEqual({ nivel: 'baja', enEnsayo: 0, sinCantar: 0 })
  })

  test('en ensayo pero ya cantadas es media', () => {
    const r = nivelDeComplejidad([
      { id: 'a', estado: 'listo', veces: 3 },
      { id: 'b', estado: 'en_ensayo', veces: 4 },
    ])
    expect(r).toEqual({ nivel: 'media', enEnsayo: 1, sinCantar: 0 })
  })

  test('en ensayo sin cantar nunca es alta', () => {
    const r = nivelDeComplejidad([
      { id: 'a', estado: 'en_ensayo', veces: 0 },
      { id: 'b', estado: 'listo', veces: 9 },
    ])
    expect(r).toEqual({ nivel: 'alta', enEnsayo: 1, sinCantar: 1 })
  })

  test('el mismo canto en dos momentos cuenta una vez', () => {
    const r = nivelDeComplejidad([
      { id: 'a', estado: 'en_ensayo', veces: 0 },
      { id: 'a', estado: 'en_ensayo', veces: 0 },
    ])
    expect(r).toEqual({ nivel: 'alta', enEnsayo: 1, sinCantar: 1 })
  })

  test('sin cantos es baja', () => {
    expect(nivelDeComplejidad([])).toEqual({ nivel: 'baja', enEnsayo: 0, sinCantar: 0 })
  })
})
```

- [ ] **Step 2: Correr y ver el fallo**

Run: `npx vitest run lib/motores/complejidad.test.ts`
Expected: FAIL — no existe `nivelDeComplejidad`.

- [ ] **Step 3: Implementar `nivelDeComplejidad` en `lib/motores/complejidad.ts`**

Contar por `id` con un `Set` (como `contarEnEnsayo` de `estado-canto.ts`); `veces` es `number` que ya llega del historial.

- [ ] **Step 4: Correr y ver el verde**

Run: `npx vitest run lib/motores/complejidad.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/motores/complejidad.ts lib/motores/complejidad.test.ts
git commit -m "feat: complejidad de la misa calculada por estado e historial"
```

---

### Task 2: Presets de letra (Pequeño · Regular · Grande)

**Files:**
- Modify: `lib/motores/tamano-letra.ts`
- Test: `lib/motores/tamano-letra.test.ts` (modificar)
- Modify: `lib/datos/repertorio.ts:144-162` (`preferenciasDelPerfil`)
- Modify: `app/repertorio/[cantoId]/acciones.ts:73-95` (`guardarTamanoLetra`)

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `TAMANOS = ['pequeno', 'regular', 'grande'] as const`; `type TamanoDeLetra = (typeof TAMANOS)[number]`; `PIXELES: Record<TamanoDeLetra, number> = { pequeno: 18, regular: 22, grande: 28 }`; `TAMANO_POR_DEFECTO: TamanoDeLetra = 'regular'`; `presetDePixeles(px: number): TamanoDeLetra` (`<= 19` → `pequeno`, `<= 25` → `regular`, si no `grande`); `siguienteTamano(actual: TamanoDeLetra, direccion: 1 | -1): TamanoDeLetra`; `esTamanoValido(valor: unknown): valor is number` ahora solo acepta 18 | 22 | 28.

- [ ] **Step 1: Reescribir los tests que fallan**

En `tamano-letra.test.ts`, reemplazar los valores viejos:

```ts
expect([PIXELES.pequeno, PIXELES.regular, PIXELES.grande]).toEqual([18, 22, 28])
expect(TAMANO_POR_DEFECTO).toBe('regular')
expect(esTamanoValido(18)).toBe(true)
expect(esTamanoValido(20)).toBe(false)
expect(presetDePixeles(14)).toBe('pequeno')
expect(presetDePixeles(24)).toBe('regular')
expect(presetDePixeles(32)).toBe('grande')
expect(siguienteTamano('regular', 1)).toBe('grande')
expect(siguienteTamano('pequeno', -1)).toBe('pequeno')
```

- [ ] **Step 2: Correr y ver el fallo**

Run: `npx vitest run lib/motores/tamano-letra.test.ts`
Expected: FAIL — `PIXELES` no existe y `esTamanoValido` acepta valores viejos.

- [ ] **Step 3: Implementar los presets en `lib/motores/tamano-letra.ts`**

Se van `TAMANO_MIN/MAX/PASO` y `cambiarTamano(actual: number, ...)`; entra `cambiarTamano(actual: TamanoDeLetra | number, direccion)` que normaliza con `presetDePixeles` y mueve por la lista `TAMANOS`.

- [ ] **Step 4: Normalizar al leer y validar al escribir**

En `preferenciasDelPerfil()`: `tamanoLetra: PIXELES[presetDePixeles(data?.tamano_letra ?? TAMANO_POR_DEFECTO)]` (los valores viejos guardados se normalizan al leer; la base no se migra). En `guardarTamanoLetra`, el mensaje de rechazo pasa a «Ese tamaño de letra no está disponible.» (ya existe); la validación queda con `esTamanoValido`.

- [ ] **Step 5: Correr el verde y el typecheck**

Run: `npx vitest run lib/motores/tamano-letra.test.ts && npx tsc --noEmit`
Expected: PASS y sin errores (los usos de `TAMANO_MAX`/`TAMANO_MIN` en `controles.tsx` romperán: ajustarlos en esta tarea solo para que compile, dejando los botones A−/A+ funcionando con `cambiarTamano`; la hoja de presets llega en la tarea 7).

- [ ] **Step 6: Commit**

```bash
git add lib/motores/tamano-letra.ts lib/motores/tamano-letra.test.ts lib/datos/repertorio.ts app/repertorio/[cantoId]/acciones.ts app/repertorio/[cantoId]/controles.tsx
git commit -m "feat: letra en tres presets (18, 22 y 28 px) normalizada al leer"
```

---

### Task 3: Cifrado a tamaño real, con reflow por ancho

**Files:**
- Create: `lib/motores/cifrado-ancho.ts`
- Test: `lib/motores/cifrado-ancho.test.ts`
- Modify: `app/componentes/cifrado.tsx` (la fórmula `fontSize` y el cálculo de `columnas`)

**Interfaces:**
- Consumes: `renderizarCifrado(cifrado, { ancho, ... })` de `lib/motores/renderizar-cifrado`.
- Produces: `ANCHO_CARACTER = 0.615`; `columnasPara(tamano: number, anchoPx: number): number` = `Math.max(14, Math.floor(anchoPx / (tamano * ANCHO_CARACTER)))`.

- [ ] **Step 1: Escribir los tests que fallan**

```ts
import { describe, expect, test } from 'vitest'
import { ANCHO_CARACTER, columnasPara } from './cifrado-ancho'

describe('columnasPara', () => {
  test('a 328 px con 22 px entran 24 columnas', () => {
    expect(columnasPara(22, 328)).toBe(24)
  })

  test('a 328 px con 28 px entran 19 columnas', () => {
    expect(columnasPara(28, 328)).toBe(19)
  })

  test('las columnas calculadas siempre caben en el ancho', () => {
    for (const [tamano, ancho] of [[18, 328], [22, 328], [28, 328], [22, 296], [28, 296]] as const) {
      const c = columnasPara(tamano, ancho)
      expect(c * tamano * ANCHO_CARACTER).toBeLessThanOrEqual(ancho)
      expect(c).toBeGreaterThanOrEqual(14)
    }
  })

  test('un ancho mínimo no da cero columnas', () => {
    expect(columnasPara(28, 80)).toBe(14)
  })
})
```

- [ ] **Step 2: Correr y ver el fallo**

Run: `npx vitest run lib/motores/cifrado-ancho.test.ts`
Expected: FAIL — no existe `columnasPara`.

- [ ] **Step 3: Implementar `columnasPara` en `lib/motores/cifrado-ancho.ts`**

Mover `ANCHO_CARACTER` y la constante de piso (14) acá; borrar `COLUMNAS_BASE`/`TAMANO_BASE` y la vieja `columnasPara` de `cifrado.tsx`.

- [ ] **Step 4: Medir el ancho y fijar el tamaño en `cifrado.tsx`**

El componente pasa a medir su contenedor con un `ResizeObserver` sobre el `div` de `containerType` (ancho = `entry.contentRect.width`), calcula `columnasPara(tamano, ancho)` para el `ancho` de `renderizarCifrado`, y el estilo queda `fontSize: '${tamano}px'` SIN el `min(...)` — la letra nunca se encoge; el reflow lo hacen las columnas.

- [ ] **Step 5: Correr el verde y la suite**

Run: `npx vitest run lib/motores/cifrado-ancho.test.ts && npm test && npx tsc --noEmit`
Expected: PASS; los tests de `renderizar-cifrado` intactos.

- [ ] **Step 6: Commit**

```bash
git add lib/motores/cifrado-ancho.ts lib/motores/cifrado-ancho.test.ts app/componentes/cifrado.tsx
git commit -m "fix: la letra se ve al tamaño del preset y se reparte por ancho"
```

---

### Task 4: Celebracion y lugar en la misa

**Files:**
- Create: `supabase/migrations/20261123000000_misa_contexto.sql`
- Modify: `lib/datos/misas.ts` (tipos y selects de la misa)
- Modify: `app/misas/acciones.ts` (acción nueva)

**Interfaces:**
- Consumes: `exigir` de `app/misas/acciones.ts`.
- Produces: columnas `public.misas.celebracion text`, `public.misas.lugar text` (NULL); `obtenerMisa` devuelve `celebracion: string | null; lugar: string | null`; acción `guardarContextoDeMisa(raw: unknown): Promise<Resultado>` con zod `{ misaId: uuid, celebracion: string ≤ 200 (vacío → null), lugar: string ≤ 200 (vacío → null) }`.

- [ ] **Step 1: Escribir la migración**

```sql
alter table public.misas add column if not exists celebracion text;
alter table public.misas add column if not exists lugar text;
```

Sin tabla nueva: las políticas de `misas` ya cubren las columnas. Sin cambios en `verificar-rls.ts`.

- [ ] **Step 2: Aplicarla en la base local**

Run: `docker exec -i supabase_db_cantoral psql -U postgres -d postgres < supabase/migrations/20261123000000_misa_contexto.sql`
Expected: sin errores; `\d public.misas` muestra las dos columnas.

- [ ] **Step 3: Leerlas en `lib/datos/misas.ts`**

Sumar `celebracion, lugar` a los selects de `obtenerMisa` (y donde la misa viaje entera), mapear a `celebracion: f.celebracion ?? null` y `lugar: f.lugar ?? null`; el resto de la app no cambia (campos opcionales).

- [ ] **Step 4: Escribir `guardarContextoDeMisa` en `app/misas/acciones.ts`**

`const Contexto = z.object({ misaId: z.string().uuid(), celebracion: z.string().trim().max(200).optional(), lugar: z.string().trim().max(200).optional() })`; `exigir('editar_misa')`; `update` con `celebracion: v || null` y `lugar: v || null`; `revalidatePath('/misas')` y `revalidatePath('/misas/' + misaId)`; errores con mensajes claros.

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit && npm run lint && NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:56321 node --env-file=.env.development.local supabase/seed/verificar-rls.ts`
Expected: sin errores; RLS 97/97 (sin comprobaciones nuevas ni rotas).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261123000000_misa_contexto.sql lib/datos/misas.ts app/misas/acciones.ts
git commit -m "feat: celebracion y lugar de la misa, texto libre"
```

---

### Task 5: Misas como calendario del mes

**Files:**
- Modify: `app/misas/page.tsx` (reemplazo)
- Create: `app/misas/calendario.tsx` (client: grilla + detalle del día)
- Create: `lib/motores/calendario.ts` (puro: qué días de un mes tienen misa y sus marcas)
- Test: `lib/motores/calendario.test.ts`

**Interfaces:**
- Consumes: `misasDelCoro`, `obtenerMisa`, `lecturasDeMisa` (`lib/datos/lecturas.ts`), `sugerenciasDeMisa` + `rankear`, `fechaLarga`, `puede`, `Cabecera`.
- Produces: `diasConMisa(misas: { fecha: string | null }[], mes: { anio: number; mes: number }): Set<string>` (claves `AAAA-MM-DD`); `marcasDeDia(lecturas: number, propuestas: number): { libro: boolean; punto: boolean }`.

- [ ] **Step 1: Escribir los tests que fallan del motor de calendario**

```ts
test('agrupa las misas del mes y descarta las de otros meses y sin fecha', () => {
  const dias = diasConMisa(
    [
      { fecha: '2026-11-22' },
      { fecha: '2026-11-01' },
      { fecha: '2026-12-01' },
      { fecha: null },
    ],
    { anio: 2026, mes: 10 }
  )
  expect([...dias].sort()).toEqual(['2026-11-01', '2026-11-22'])
})

test('las marcas reflejan lecturas y propuestas', () => {
  expect(marcasDeDia(0, 0)).toEqual({ libro: false, punto: false })
  expect(marcasDeDia(4, 0)).toEqual({ libro: true, punto: false })
  expect(marcasDeDia(0, 2)).toEqual({ libro: false, punto: true })
  expect(marcasDeDia(4, 2)).toEqual({ libro: true, punto: true })
})
```

- [ ] **Step 2: Correr y ver el fallo**

Run: `npx vitest run lib/motores/calendario.test.ts`
Expected: FAIL — no existe el módulo.

- [ ] **Step 3: Implementar `lib/motores/calendario.ts`**

`mes` va 0-indexado (enero = 0); la clave se arma con `String(...).padStart(2, '0')`.

- [ ] **Step 4: Reescribir `app/misas/page.tsx`**

Server Component que lee `searchParams` (`mes` = `AAAA-MM` opcional, default el mes actual; `dia` = `AAAA-MM-DD` opcional, default el día con misa más cercano del mes, o el 1): carga `misasDelCoro`, arma el mes (título «Noviembre 2026», resumen «n misas · n con lecturas · n propuestas» — las propuestas se cuentan solo para los días con misa del mes, consultando `sugerenciasDeMisa` por cada una), y para el día seleccionado carga `obtenerMisa` + `lecturasDeMisa` + `sugerenciasDeMisa` para el detalle (celebración, lecturas o «Sin lecturas cargadas todavía», propuestas con ««nota» — Nombre» o «Nadie propuso canciones para esta misa»). Día sin misa: «Este día no tiene misa armada» + enlace «Armar misa» (`/misas/nueva`) solo si `puede('editar_misa')`. Conserva `Cabecera` y la barra de abajo; el enlace «Nueva misa» queda como ícono en la cabecera de la pantalla si puede editar.

- [ ] **Step 5: Escribir `app/misas/calendario.tsx` (client)**

Recibe los datos del mes y del día como props (sin fetch): grilla de 7 columnas con cabecera `D L M X J V S`, días sin misa planos, con misa en `superficie`, marcas libro/punto, seleccionado con borde; la navegación de mes y la selección de día son enlaces (`?mes=...&dia=...`) — no estado: el detalle lo renderiza el server.

- [ ] **Step 6: Verificar en la app (sin abrir navegador el implementador)**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: en verde. Dejar en el reporte la lista de comprobaciones manuales (mes con misas, mes vacío, día sin misa, día con lecturas y propuestas) para el recorrido de la tarea 9.

- [ ] **Step 7: Commit**

```bash
git add lib/motores/calendario.ts lib/motores/calendario.test.ts app/misas/page.tsx app/misas/calendario.tsx
git commit -m "feat: misas en calendario del mes con lecturas y propuestas"
```

---

### Task 6: Hoy como la próxima misa, con contexto e íconos

**Files:**
- Modify: `app/page.tsx` (reemplazo del tablero por «Hoy»)
- Create: `app/componentes/contexto-misa.tsx` (client)
- Create: `app/componentes/ayuda.tsx` (client, hoja «Cómo leer»)

**Interfaces:**
- Consumes: `obtenerMisa`, `misasDelCoro`, `misaDeInicio`, `nivelDeComplejidad` (task 1), `repertorioConHistorial`, `etiquetaEstado`, `puede`, `Cabecera`, `fechaLarga`, `cuantoFalta`.
- Produces: `ContextoMisa({ coro, nivel, celebracion, lugar, onGuardarContexto, puedeEditar })` — fila de cuatro íconos (coro, barras según nivel, estrella, pin) cada uno abriendo una línea de info que se colapsa sola a los 5 s; en modo director, un botón lápiz que abre un `<dialog>` chico con dos campos (`celebracion`, `lugar`) que llama `guardarContextoDeMisa` (task 4) y `router.refresh()`. `Ayuda({ etiqueta = 'Cómo leer' })` — hoja con el texto fijo de la maqueta (Empezar, barra de abajo, Aa, acordes, lecturas y partes, contexto, calendario) y cierre con X.

- [ ] **Step 1: Reescribir `app/page.tsx`**

Conserva el portón (`rutaInicial`, `sesion`, `coroActivo`). Carga `misaDeInicio` + `obtenerMisa` (cantos con estado) + `repertorioConHistorial`. Renderiza: título de la misa (`misa.nombre`), meta (fecha larga · n cantos), la fila de acciones (enlace «Empezar» con play → `/misas/[id]/[filaId]` del PRIMER canto en orden; «La misa» con lista → `/misas/[id]`), el `ContextoMisa` en la misma fila (coro = `sesion.coroActivo.nombre`; nivel = `nivelDeComplejidad` sobre `misa.cantos` con `veces` del historial; `celebracion`/`lugar` de la misa), y debajo la lista de cantos («La misa») con cada fila marcando «En ensayo» con `etiquetaEstado`. Sin lecturas en Hoy (viven en La misa). Sin misa próxima: el título pasa a «No hay ninguna misa agendada» con «Armar una misa» para el director. El «?» (`Ayuda`) va en la cabecera.

- [ ] **Step 2: Escribir `contexto-misa.tsx` y `ayuda.tsx`**

Componentes client con los tokens de `globals.css` (`tactil`, `icon-btn`, superficies); el colapso usa `setTimeout` de 5000 ms cancelado al volver a tocar o al desmontar; los íconos salen de `app/componentes/iconos.tsx` (agregar ahí `IconoCoro`, `IconoComplejidad` con 1/2/3 barras según `nivel`, `IconoCelebracion`, `IconoLugar` si no existen, trazo 1,75 sobre grilla de 24).

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: en verde. Dejar comprobaciones manuales para la tarea 9 (colapso a 5 s, sin scroll horizontal, Hoy sin misa, edición de celebración/lugar).

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx app/componentes/contexto-misa.tsx app/componentes/ayuda.tsx app/componentes/iconos.tsx
git commit -m "feat: hoy es la proxima misa con contexto en iconos"
```

---

### Task 7: La misa con contexto y el lector de una tarea

**Files:**
- Modify: `app/misas/[id]/page.tsx` (contexto + fila de acciones con íconos; lecturas ya viven acá)
- Modify: `app/misas/[id]/[filaId]/page.tsx` (barra fija de cuatro acciones)
- Modify: `app/repertorio/[cantoId]/controles.tsx` y `panel-lectura.tsx` (Aa pasa a hoja de presets)
- Create: `app/componentes/hoja-tamano.tsx` (client: Pequeño 18 · Regular 22 · Grande 28 con tilde, llamando `guardarTamanoLetra`)

**Interfaces:**
- Consumes: `ContextoMisa` y `Ayuda` (task 6), `guardarContextoDeMisa` (task 4), `guardarTamanoLetra` (task 2), `TAMANOS`/`PIXELES`/`siguienteTamano` (task 2), `Lector` y `PuertaLecturas` existentes.
- Produces: `HojaTamano({ abierto, onCerrar, actual })` — hoja inferior con los tres presets; al elegir llama `guardarTamanoLetra(PIXELES[t])` y cierra.

- [ ] **Step 1: Contexto en `app/misas/[id]/page.tsx`**

Sumar `celebracion`/`lugar` de la misa y el historial del coro a las cargas; renderizar `ContextoMisa` bajo el título (misma fila que «Empezar»/«Editar» con íconos, como en la maqueta); «Editar» pasa a ícono de lápiz; el «?» en la cabecera; las lecturas siguen en su sección con el libro.

- [ ] **Step 2: Barra fija del lector en la ejecución**

En `[filaId]/page.tsx`, la fila inferior pasa a: anterior (ícono, deshabilitado en el primero) · **Aa** (abre `HojaTamano`) · auto-scroll (play/pausa, conserva el auto-scroll existente) · siguiente. Arriba: el ícono de acordes (nota musical, alterna `mostrarAcordes`), el libro (lecturas), la lista (cantos de la misa) y el «?». El panel `PanelLectura` sigue existiendo para la transposición; Aa sale de él y vive en la barra.

- [ ] **Step 3: Aa en la lectura del repertorio**

En `controles.tsx`/`panel-lectura.tsx`, los botones A−/A+ se reemplazan por el botón Aa que abre `HojaTamano`; el número mostrado es el del preset elegido. La transposición y el resto del panel no cambian.

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: en verde. Dejar comprobaciones manuales (presets en ambos lectores, barra fija sin scroll horizontal, Aa persiste al recargar) para la tarea 9.

- [ ] **Step 5: Commit**

```bash
git add app/misas/[id]/page.tsx app/misas/[id]/[filaId]/page.tsx app/repertorio/[cantoId]/controles.tsx app/repertorio/[cantoId]/panel-lectura.tsx app/componentes/hoja-tamano.tsx
git commit -m "feat: lector de una tarea con barra fija y presets de letra"
```

---

### Task 8: Biblioteca por tramos cortos

**Files:**
- Modify: `app/repertorio/page.tsx` (tramos y «Ver el resto»)

**Interfaces:**
- Consumes: `VistaTodas` y la lista por momentos existentes.
- Produces: `TRAMO = 6`; «Ver el resto (n)» por momento, recordado en `mas=` como hoy.

- [ ] **Step 1: Bajar el tramo y ajustar el botón**

`TRAMO` pasa de 100 a 6; el botón «Ver más» pasa a «Ver el resto (n)» y conserva la lógica de `mas=`/`#momento-` existente. `VistaTodas` mantiene su paginación.

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit && npm run lint && npm test`
Expected: en verde. Dejar para la tarea 9: la lista inicial ya no monta 500 filas (medir `scrollHeight` y cantidad de botones).

- [ ] **Step 3: Commit**

```bash
git add app/repertorio/page.tsx
git commit -m "perf: la lista de Canciones abre por tramos de 6"
```

---

### Task 9: Verificación final

**Files:** ninguno nuevo.

- [ ] **Step 1: Correr todo**

```bash
npx tsc --noEmit
npm run lint
npm test
npm run build
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:56321 node --env-file=.env.development.local supabase/seed/verificar-rls.ts
```

Expected: todo en verde; RLS 97/97.

- [ ] **Step 2: Recorrido a 360 px con Playwright (autorizado por el dueño)**

Hoy con misa (Empezar entra al primer canto; contexto se colapsa a los 5 s; sin lecturas en Hoy) · La misa con contexto y lecturas · calendario (mes con misas, mes vacío, día sin misa con «Armar misa» solo director) · lector con barra fija (Aa → Grande = 28 px reales en `getComputedStyle`; anterior/siguiente; auto-scroll) · lectura del repertorio con presets · biblioteca con tramos de 6 y «Ver el resto (n)» · miembro sin acciones de edición. Sin scroll horizontal (`scrollWidth <= clientWidth`), sin errores de consola.

- [ ] **Step 3: Commit final (si hubo ajustes)**

```bash
git add -A
git commit -m "fix: ajustes de la verificacion del rediseno de lectura"
```
