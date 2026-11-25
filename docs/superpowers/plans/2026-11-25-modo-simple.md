# Modo simple — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar al miembro un modo simple de Cantoral —tres destinos, la misa a la que va, inscripción «Voy / No voy», lectura sin acordes, favoritas y lecturas on/off— reversible desde «Más», sin tocar la app del director.

**Architecture:** Una preferencia por persona (`preferencias_perfil.modo`) resuelta por un motor puro contra el rol global y el rol local. La misma ruta `/` y el mismo lector tienen una variante simple gobernada por `sesion.modo`; las pantallas nuevas (`/favoritas`) son islas del mismo armazón. RLS y actions no cambian de dueño: el modo es presentación.

**Tech Stack:** Next.js 16 (App Router, Server Components), React 19, Supabase (RLS), Tailwind 4, zod, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-25-modo-simple-design.md`

## Global Constraints

- Todo el código, comentarios y UI en español; la UI tutea.
- RLS activa en la misma migración que crea o cambia la tabla; los casos nuevos van a `supabase/seed/verificar-rls.ts`.
- Motores puros en `lib/motores/`: sin Supabase, sin red, sin reloj; cada uno con su `.test.ts`.
- Cero valores derivados persistidos: la misa de Mi misa y el resumen se calculan al leer.
- Ningún color escrito a mano fuera de `app/globals.css`; el ámbar (`--color-acorde`) sigue siendo solo de los acordes.
- Objetivos táctiles de 44 px; nada de scroll horizontal a 360 px.
- Tests: `npx vitest run <archivo>`. Tipos y build: `npm run build`.
- Migraciones: local con `npm run db:reset`; producción se aplica a mano después del deploy, fuera de este plan.
- Verificación RLS local: `node --env-file=.env.development.local supabase/seed/verificar-rls.ts` (nunca `.env.local`, que apunta a producción).
- No tocar `../motor`, `../pruebas`, `../diseno`, `../assets` ni los PDF de `../docs/`.

## Review Focus

- **Director o admin con `modo = simple` guardado:** debe ver la app normal. `modoEfectivo` lo resuelve antes de cualquier pantalla.
- **Miembro sin coro activo con `simple` guardado:** debe ver normal y no romper la barra ni la cabecera.
- **Tamaño ya elegido (18 o 28):** no debe saltar a Grande al entrar en simple; solo salta el 22 que era el default.
- **Inscripción `asistencia`:** no puede contarse como voz ni como instrumento, y no puede llevar instrumento; el resumen del director tiene que seguir siendo exacto.
- **Anclar una favorita de un canto invisible:** la RLS lo rechaza y la pantalla no muestra un falso «anclada».

---

### Task 1: Migración de preferencias (modo, tamaño elegido, lecturas)

**Files:**
- Create: `supabase/migrations/20261125000000_modo_simple.sql`

**Interfaces:**
- Produces columns `preferencias_perfil.modo` (`null | 'simple' | 'normal'`), `tamano_letra_elegido` (boolean), `mostrar_lecturas` (boolean).

- [ ] **Step 1: Escribir la migración**

```sql
alter table public.preferencias_perfil
  add column if not exists modo text,
  add column if not exists tamano_letra_elegido boolean not null default false,
  add column if not exists mostrar_lecturas boolean not null default false;

alter table public.preferencias_perfil
  drop constraint if exists preferencias_perfil_modo_check;
alter table public.preferencias_perfil
  add constraint preferencias_perfil_modo_check
  check (modo is null or modo in ('simple', 'normal'));

update public.preferencias_perfil
   set tamano_letra_elegido = true
 where tamano_letra in (18, 28);

comment on column public.preferencias_perfil.modo is
  'Modo de la app elegido por la persona (2026-11-25). null = todavía no eligió; el modo efectivo lo resuelve modoEfectivo con su rol.';
comment on column public.preferencias_perfil.tamano_letra_elegido is
  'true si la persona tocó «Aa». El modo simple usa Grande mientras sea false.';
comment on column public.preferencias_perfil.mostrar_lecturas is
  'En el modo simple, si quiere ver las lecturas ya guardadas por el director en «Mi misa».';
```

- [ ] **Step 2: Aplicar en local**

Con el stack local levantado (`npx supabase start` si hace falta), Run: `npm run db:reset`
Expected: todas las migraciones aplican sin error; la base local queda sembrada.

- [ ] **Step 3: Comprobar las columnas**

Run: `npx supabase status` y, con la `DB URL` que imprime, `psql "<DB URL>" -c "\d public.preferencias_perfil"`.
Expected: aparecen `modo`, `tamano_letra_elegido`, `mostrar_lecturas`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261125000000_modo_simple.sql
git commit -m "feat: preferencias del modo simple"
```

---

### Task 2: Motor `modoEfectivo`

**Files:**
- Create: `lib/motores/modo.ts`
- Test: `lib/motores/modo.test.ts`

**Interfaces:**
- Consumes: `Rol`, `RolLocal` de `lib/permisos.ts`.
- Produces:
  ```ts
  export type Modo = 'simple' | 'normal'
  export type ModoGuardado = Modo | null
  export function modoEfectivo(entrada: {
    rol: Rol
    rolLocal: RolLocal | null
    guardado: ModoGuardado
  }): Modo
  ```

- [ ] **Step 1: Escribir el test que falla**

```ts
import { describe, expect, test } from 'vitest'
import { modoEfectivo } from './modo'

describe('modoEfectivo', () => {
  test('el admin y el director siempre ven normal', () => {
    expect(modoEfectivo({ rol: 'admin', rolLocal: 'miembro', guardado: 'simple' })).toBe('normal')
    expect(modoEfectivo({ rol: 'usuario', rolLocal: 'director', guardado: 'simple' })).toBe('normal')
  })

  test('un miembro sin elección entra en simple', () => {
    expect(modoEfectivo({ rol: 'usuario', rolLocal: 'miembro', guardado: null })).toBe('simple')
  })

  test('la elección explícita del miembro manda', () => {
    expect(modoEfectivo({ rol: 'usuario', rolLocal: 'miembro', guardado: 'normal' })).toBe('normal')
    expect(modoEfectivo({ rol: 'usuario', rolLocal: 'miembro', guardado: 'simple' })).toBe('simple')
  })

  test('sin coro activo, simple guardado no encierra a nadie', () => {
    expect(modoEfectivo({ rol: 'usuario', rolLocal: null, guardado: 'simple' })).toBe('normal')
  })
})
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run lib/motores/modo.test.ts`
Expected: FAIL porque `./modo` no existe.

- [ ] **Step 3: Implementar el motor**

```ts
import type { Rol, RolLocal } from '@/lib/permisos'

export type Modo = 'simple' | 'normal'
export type ModoGuardado = Modo | null

export function modoEfectivo({ rol, rolLocal, guardado }: {
  rol: Rol
  rolLocal: RolLocal | null
  guardado: ModoGuardado
}): Modo {
  if (rol === 'admin') return 'normal'
  if (rolLocal !== 'miembro') return 'normal'
  return guardado ?? 'simple'
}
```

- [ ] **Step 4: Correr el test y verlo pasar**

Run: `npx vitest run lib/motores/modo.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/motores/modo.ts lib/motores/modo.test.ts
git commit -m "feat: motor modoEfectivo"
```

---

### Task 3: Tamaño de lectura y la acción que marca la elección

**Files:**
- Modify: `lib/motores/tamano-letra.ts`
- Modify: `lib/motores/tamano-letra.test.ts`
- Modify: `app/repertorio/[cantoId]/acciones.ts`

**Interfaces:**
- Consumes: `PIXELES`, `Modo`.
- Produces: `tamanoDeLectura(modo: Modo, guardado: number, elegido: boolean): number`.
- `guardarTamanoLetra` ahora escribe `tamano_letra_elegido: true`.

- [ ] **Step 1: Escribir el test que falla**

```ts
import { tamanoDeLectura } from './tamano-letra'

test('simple sin elección usa Grande; con elección respeta lo guardado', () => {
  expect(tamanoDeLectura('simple', 22, false)).toBe(28)
  expect(tamanoDeLectura('simple', 18, true)).toBe(18)
  expect(tamanoDeLectura('normal', 22, false)).toBe(22)
  expect(tamanoDeLectura('normal', 18, true)).toBe(18)
})
```

- [ ] **Step 2: Correr el test y verlo fallar**

Run: `npx vitest run lib/motores/tamano-letra.test.ts`
Expected: FAIL porque `tamanoDeLectura` no existe.

- [ ] **Step 3: Implementar**

```ts
import type { Modo } from './modo'

export function tamanoDeLectura(modo: Modo, guardado: number, elegido: boolean): number {
  return modo === 'simple' && !elegido ? PIXELES.grande : guardado
}
```

- [ ] **Step 4: Marcar la elección en la action**

En `guardarTamanoLetra`, el `upsert` de `preferencias_perfil` suma `tamano_letra_elegido: true`.

- [ ] **Step 5: Correr el test y el lint**

Run: `npx vitest run lib/motores/tamano-letra.test.ts && npx eslint lib/motores/tamano-letra.ts 'app/repertorio/[cantoId]/acciones.ts'`
Expected: PASS y sin errores.

- [ ] **Step 6: Commit**

```bash
git add lib/motores/tamano-letra.ts lib/motores/tamano-letra.test.ts 'app/repertorio/[cantoId]/acciones.ts'
git commit -m "feat: tamaño de lectura del modo simple"
```

---

### Task 4: Preferencias y sesión con el modo efectivo

**Files:**
- Modify: `lib/datos/repertorio.ts` (`PreferenciasDelPerfil`, `preferenciasDelPerfil`)
- Modify: `lib/sesion.ts` (`SesionCantoral`, consulta de perfiles, cálculo del modo)

**Interfaces:**
- Consumes: `modoEfectivo`, `Modo`.
- Produces:
  ```ts
  // PreferenciasDelPerfil
  {
    mostrarAcordes: boolean
    tamanoLetra: number
    tamanoElegido: boolean
    herramientas: Herramienta[]
    modoGuardado: Modo | null
    mostrarLecturas: boolean
  }
  // SesionCantoral
  modo: Modo
  ```

- [ ] **Step 1: Extender `PreferenciasDelPerfil` y su consulta**

Cambiar el `select` a `'mostrar_acordes, tamano_letra, tamano_letra_elegido, herramientas, modo, mostrar_lecturas'` y devolver los campos nuevos; `modo` se valida con `modo === 'simple' || modo === 'normal' ? modo : null`.

- [ ] **Step 2: Extender `SesionCantoral` y la consulta de `obtenerSesion`**

En el `select` de `perfiles`, sumar `preferencias_perfil(modo)`. Después de resolver `coroActivo`, agregar:

```ts
const modo = modoEfectivo({
  rol,
  rolLocal: coroActivo?.rolLocal ?? null,
  guardado: modoGuardado,
})
```

y devolverlo en la sesión. `modoGuardado` se normaliza igual que en `preferenciasDelPerfil`.

- [ ] **Step 3: Verificar tipos**

Run: `npm run build`
Expected: compila; los errores de consumidores que esperan el nuevo tipo se corrigen en las tareas siguientes.

- [ ] **Step 4: Commit**

```bash
git add lib/datos/repertorio.ts lib/sesion.ts
git commit -m "feat: sesión y preferencias conocen el modo"
```

---

### Task 5: Barra de tres destinos y cabecera sin buscador

**Files:**
- Modify: `app/componentes/barra-nav.tsx`
- Modify: `app/componentes/cabecera.tsx`

**Interfaces:**
- Consumes: `sesion.modo`.
- Produces: barra simple `Mi misa (/), Misas (/misas), Más (/mas)`.

- [ ] **Step 1: Ramificar la barra**

Si `sesion.modo === 'simple'`, `destinos` es:

```ts
[
  { href: '/', texto: 'Mi misa', icono: <IconoInicio />, exacto: true },
  { href: '/misas', texto: 'Misas', icono: <IconoMisas /> },
  { href: '/mas', texto: 'Más', icono: <IconoMas />, tambien: ['/favoritas'] },
]
```

Si no, la barra actual queda igual.

- [ ] **Step 2: Ocultar el buscador global en simple**

En `Cabecera`, el buscador se dibuja solo con `buscador && sesion.coroActivo && sesion.modo === 'normal'`.

- [ ] **Step 3: Verificar**

Run: `npx eslint app/componentes/barra-nav.tsx app/componentes/cabecera.tsx && npm run build`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/componentes/barra-nav.tsx app/componentes/cabecera.tsx
git commit -m "feat: navegación del modo simple"
```

---

### Task 6: «Más» simple, «Más» normal con vuelta, y la acción de modo

**Files:**
- Create: `app/mas/acciones.ts`
- Modify: `app/mas/page.tsx`
- Modify: `app/mas/opciones.tsx`

**Interfaces:**
- Produces: `guardarModo(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }>`.
- `Opciones` acepta `acciones?: ReactNode` para una fila que no es enlace.

- [ ] **Step 1: Crear la action**

```ts
'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'

const Entrada = z.object({ modo: z.enum(['simple', 'normal']) })

export async function guardarModo(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const { modo } = Entrada.parse(raw)
  const sesion = await obtenerSesion()
  if (!sesion) return { ok: false, error: 'Tu sesión expiró. Vuelve a entrar.' }
  if (!puede(sesion.sujeto, 'guardar_preferencia_propia')) {
    return { ok: false, error: 'Tu cuenta todavía no está habilitada.' }
  }
  const supabase = await createClient()
  const { error } = await supabase.from('preferencias_perfil').upsert(
    { perfil_id: sesion.usuarioId, modo, updated_at: new Date().toISOString() },
    { onConflict: 'perfil_id' }
  )
  if (error) return { ok: false, error: 'No se guardó el modo. Revisa tu conexión.' }
  revalidatePath('/', 'layout')
  return { ok: true }
}
```

- [ ] **Step 2: «Más» simple**

Si `sesion.modo === 'simple'`, `MasPage` dibuja una lista corta: «Mi perfil» (si `editar_ficha_propia`), «Mis coros» (si `coros.length > 1`), «Volver a Normal» (botón que llama `guardarModo({modo:'normal'})`) y «Salir». Sin historial, sugerencias, herramientas, archivados, usuarios ni miembros. Las filas «Tema» y «Lecturas del domingo» se agregan en Task 11 y Task 9, para que cada tarea compile sola.

- [ ] **Step 3: «Más» normal con vuelta**

Si el sujeto es miembro (`rol !== 'admin'` y `rolLocal === 'miembro'`), agregar una fila «Modo simple» que llama `guardarModo({modo:'simple'})`. Para eso, extender `Opciones` con `acciones?: ReactNode` y dibujarlo antes de «Salir».

- [ ] **Step 4: Verificar**

Run: `npm run build && npx eslint app/mas/page.tsx app/mas/opciones.tsx app/mas/acciones.ts`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add app/mas
git commit -m "feat: cambiar entre modo simple y normal"
```

---

### Task 7: Aporte `asistencia` y resumen honesto

**Files:**
- Create: `supabase/migrations/20261125000100_asistencia_misa.sql`
- Modify: `lib/motores/inscripcion.ts`
- Modify: `lib/motores/inscripcion.test.ts`
- Modify: `supabase/seed/verificar-rls.ts`
- Modify: `app/misas/[id]/page.tsx` (mostrar «N van sin especificar»)

**Interfaces:**
- Produces: `APORTES` incluye `'asistencia'`; `ResumenDelCoro` suma `asisten: number`.

- [ ] **Step 1: Migración**

```sql
alter table public.misa_participante
  drop constraint if exists misa_participante_aporte_check;
alter table public.misa_participante
  add constraint misa_participante_aporte_check
  check (aporte in ('vocal', 'instrumental', 'asistencia'));

alter table public.misa_participante
  drop constraint if exists instrumento_solo_si_toca;
alter table public.misa_participante
  add constraint instrumento_solo_si_toca check (
    (aporte = 'instrumental' and instrumento is not null) or
    (aporte in ('vocal', 'asistencia') and instrumento is null)
  );
```

- [ ] **Step 2: Test del motor que falla**

```ts
expect(validarInscripcion({ aporte: 'asistencia', instrumento: null })).toEqual({
  ok: true,
  limpio: { aporte: 'asistencia', instrumento: null },
})
expect(validarInscripcion({ aporte: 'asistencia', instrumento: 'guitarra' }).ok).toBe(true)
expect(resumirCoro([
  { perfilId: 'a', nombre: 'Ana', aporte: 'asistencia', instrumento: null },
], []).asisten).toBe(1)
```

- [ ] **Step 3: Implementar**

`APORTES = ['vocal', 'instrumental', 'asistencia']`. En `validarInscripcion`, `asistencia` devuelve `{ aporte: 'asistencia', instrumento: null }` (limpia el instrumento, como `vocal`). En `resumirCoro`, `asisten` cuenta los `aporte === 'asistencia'`.

- [ ] **Step 4: Dibujar el resumen**

En `app/misas/[id]/page.tsx`, junto al desglose de voces e instrumentos, agregar `«N van sin especificar»` cuando `resumen.asisten > 0`. En la lista de inscritos, el aporte se dibuja como `i.aporte === 'instrumental' ? nombreInstrumento(i.instrumento) : etiquetaAporte(i.aporte)`; hoy un `asistencia` caería en `nombreInstrumento(null)` y mostraría una línea vacía.

- [ ] **Step 5: Casos de RLS**

En `verificar-rls.ts`: con `musico@`, upsert de una inscripción `asistencia` sin instrumento (debe pasar) y con `instrumento: 'guitarra'` (debe fallar); limpiar al final. Comprobar también que el miembro no puede escribir la fila de otro.

- [ ] **Step 6: Verificar**

Run: `npx vitest run lib/motores/inscripcion.test.ts && npm run build`
Expected: PASS y build limpio.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20261125000100_asistencia_misa.sql lib/motores/inscripcion.ts lib/motores/inscripcion.test.ts supabase/seed/verificar-rls.ts 'app/misas/[id]/page.tsx'
git commit -m "feat: inscripción Voy sin voz ni instrumento"
```

---

### Task 8: El control «Voy / No voy» del modo simple

**Files:**
- Modify: `app/misas/[id]/inscripcion.tsx`
- Modify: `app/misas/[id]/page.tsx` (pasar `simple`)

**Interfaces:**
- `Inscripcion` acepta `simple?: boolean`.
- En simple: dos botones «Voy» y «No voy»; «Voy» guarda `{aporte:'asistencia', instrumento:null}`; «No voy» retira.

- [ ] **Step 1: Agregar la prop y la variante**

Con `simple`, el componente dibuja `role="group" aria-label="Vas a esta misa"` con dos botones de 44 px. Si `actual` es `null`, «Voy» guarda `asistencia` y «No voy» está deshabilitado. Si `actual` existe, «Voy» va seleccionado y «No voy» retira. El estado dice «Vas a esta misa.» o «No vas.».

En la variante normal, la línea de estado actual tiene que entender `asistencia`: «Vas sin especificar.» (y los dos botones «A cantar / A tocar» quedan sin seleccionar para que la persona pueda precisar). Sin esto, `instrumento` vacío imprimiría «Te anotaste con .».

- [ ] **Step 2: Pasar `simple` desde la misa**

En `app/misas/[id]/page.tsx`, `<Inscripcion ... simple={sesion.modo === 'simple'} />`. En la misma pantalla, si es simple: ocultar `ContextoMisa`, el lápiz de contexto y la sección «Pedidos para esta misa».

- [ ] **Step 3: Verificar**

Run: `npm run build && npx eslint 'app/misas/[id]/inscripcion.tsx' 'app/misas/[id]/page.tsx'`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add 'app/misas/[id]/inscripcion.tsx' 'app/misas/[id]/page.tsx'
git commit -m "feat: Voy/No voy en el modo simple"
```

---

### Task 9: «Mi misa» y las lecturas on/off

**Files:**
- Modify: `lib/motores/agenda.ts` (nuevo selector)
- Modify: `lib/motores/agenda.test.ts`
- Modify: `lib/datos/inscripciones.ts` (nueva consulta)
- Modify: `app/mas/acciones.ts` (`guardarMostrarLecturas`)
- Create: `app/mi-misa.tsx`
- Create: `app/componentes/tarjeta-modo.tsx`
- Modify: `app/page.tsx` (ramificar)
- Modify: `app/mas/page.tsx` (interruptor)

**Interfaces:**
- `elegirMisaDeMiembro<T extends { id: string; fecha: string | null }>(todas: T[], inscritas: string[], hoy: string): T | null`
- `misasDondeVoy(usuarioId: string, coroId: string): Promise<{ id: string; nombre: string; fecha: string | null }[]>`
- `guardarMostrarLecturas(prender: boolean): Promise<{ ok: true } | { ok: false; error: string }>`

- [ ] **Step 1: Test del selector que falla**

```ts
test('prefiere la próxima misa en la que estoy inscrito', () => {
  const misas = [
    { id: 'a', fecha: '2026-11-29' },
    { id: 'b', fecha: '2026-12-06' },
  ]
  expect(elegirMisaDeMiembro(misas, ['b'], '2026-11-25')?.id).toBe('b')
  expect(elegirMisaDeMiembro(misas, [], '2026-11-25')?.id).toBe('a')
  expect(elegirMisaDeMiembro(misas, ['a'], '2026-11-25')?.id).toBe('a')
  expect(elegirMisaDeMiembro(misas, ['a'], '2026-12-01')?.id).toBe('b')
})
```

- [ ] **Step 2: Implementar el selector**

Entre las misas con `fecha >= hoy` y `id` en `inscritas`, la de fecha menor; si no hay, `misaDeInicio(todas, hoy)`.

- [ ] **Step 3: Consulta de inscripciones**

```ts
.from('misa_participante')
.select('misa_id, misas!participante_misa_del_mismo_coro(id, nombre, fecha)')
.eq('perfil_id', usuarioId)
.eq('coro_id', coroId)
```

Mapear a `{ id: misa.id, nombre: misa.nombre, fecha: misa.fecha }`.

- [ ] **Step 4: Crear `app/mi-misa.tsx`**

Server Component que recibe `sesion`. Resuelve `misasDelCoro`, `misasDondeVoy`, `elegirMisaDeMiembro`, `obtenerMisa`, `preferenciasDelPerfil`, `inscritosDeMisa` (para `miInscripcion`) y, si `prefs.mostrarLecturas`, `lecturasDeMisa`. Dibuja:
- `Cabecera sesion={sesion}` sin acciones.
- Título, fecha, cuánto falta, cantos.
- `Inscripcion simple` y «Empezar» / «La misa».
- La lista de cantos (momento + título; sin tonalidad).
- Si `mostrarLecturas`, `BloqueLecturas` con `esDirector={false}`; si no hay lecturas, una línea que lo dice.
- `<TarjetaModo guardado={prefs.modoGuardado} />` (cliente; llama `guardarModo`). Solo si `rolLocal === 'miembro'`.
- Sin misa: el estado vacío actual, sin «Armar» (el miembro no arma).

- [ ] **Step 5: Ramificar `/`**

En `app/page.tsx`, después de los redirects y del chequeo de coro activo: `if (sesion.modo === 'simple') return <MiMisa sesion={sesion} />`. El resto (Hoy) queda igual.

- [ ] **Step 6: Implementar el interruptor de lecturas**

En `app/mas/acciones.ts`, `guardarMostrarLecturas` con zod boolean, sesión, `guardar_preferencia_propia`, upsert y `revalidatePath('/', 'layout')`. En `app/mas/page.tsx` (simple), una fila «Lecturas del domingo» con un interruptor cliente que lo llama con estado optimista.

- [ ] **Step 7: Verificar**

Run: `npx vitest run lib/motores/agenda.test.ts && npm run build`
Expected: PASS y build limpio.

- [ ] **Step 8: Commit**

```bash
git add lib/motores/agenda.ts lib/motores/agenda.test.ts lib/datos/inscripciones.ts app/mi-misa.tsx app/componentes/tarjeta-modo.tsx app/page.tsx app/mas/page.tsx app/mas/acciones.ts
git commit -m "feat: Mi misa y lecturas del domingo"
```

---

### Task 10: Lectura simple (sin acordes, sin herramientas, tamaño)

**Files:**
- Modify: `app/repertorio/[cantoId]/controles.tsx` (prop `simple`)
- Modify: `app/repertorio/[cantoId]/page.tsx`
- Modify: `app/misas/[id]/[filaId]/page.tsx`

**Interfaces:**
- `Controles` acepta `simple?: boolean`; con `true` oculta transposición y el interruptor de acordes, y deja auto-scroll y tamaño.

- [ ] **Step 1: Agregar `simple` a `Controles`**

Con `simple`, no se dibuja el bloque de transposición (el `mostrarAcordes ? ... : ...`), ni `BotonAcordes`; el auto-scroll y el Aa siguen.

- [ ] **Step 2: Aplicar en la ficha del canto**

En `app/repertorio/[cantoId]/page.tsx`:
```ts
const simple = sesion.modo === 'simple'
const mostrarAcordes = simple ? false : perfil.mostrarAcordes
const tamanoLetra = tamanoDeLectura(sesion.modo, perfil.tamanoLetra, perfil.tamanoElegido)
```
Con `simple`: ocultar `PestanasCanto`, el `<details>` «Sobre este canto», `SoloLetra`, `Notacion`; mantener `ConmutadorTema`; pasar `simple` a `Controles` y `mostrarTono={false}` a `PanelLectura`.

- [ ] **Step 3: Aplicar en la ejecución de la misa**

En `app/misas/[id]/[filaId]/page.tsx`, el mismo cálculo de `mostrarAcordes` y `tamanoLetra`; con `simple`: ocultar «Ensayar este canto», `Notacion`, y el bloque de tono; pasar `simple` a `Controles` y `mostrarTono={false}`.

- [ ] **Step 4: Verificar**

Run: `npm run build && npx eslint 'app/repertorio/[cantoId]/controles.tsx' 'app/repertorio/[cantoId]/page.tsx' 'app/misas/[id]/[filaId]/page.tsx'`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add 'app/repertorio/[cantoId]' 'app/misas/[id]/[filaId]/page.tsx'
git commit -m "feat: lectura simple sin acordes ni herramientas"
```

---

### Task 11: Tema Alto contraste

**Files:**
- Modify: `app/componentes/tema.ts`
- Modify: `app/componentes/conmutador-tema.tsx`
- Create: `app/componentes/selector-tema.tsx`
- Modify: `app/globals.css`
- Modify: `app/mas/page.tsx` (fila Tema en simple)

**Interfaces:**
- `Tema = 'oscuro' | 'claro' | 'alto'`; `COLOR_BARRA.alto = '#000000'`; `esTema` acepta `alto`.
- `SelectorTema({ actual }: { actual: Tema })`.

- [ ] **Step 1: Extender el tipo**

`Tema`, `COLOR_BARRA` y `esTema` incluyen `alto`. Agregar `siguienteTema(actual): Tema` con el ciclo oscuro → claro → alto → oscuro.

- [ ] **Step 2: Tokens del tema**

En `globals.css`, agregar `:root[data-tema="alto"]` con `color-scheme: dark` y los mismos roles: fondo `#000000`, superficie `#0a0a0a`, superficie-alta `#1a1a1a`, borde `#6b6b6b`, borde-fuerte `#9a9a9a`, texto `#ffffff`, texto-tenue `#e0e0e0`, acorde `#ffb74d`, acento `#ffd166`, sobre-acento `#000000`, peligro `#ff8a75`, sobre-peligro `#000000`, exito `#8bf09a`, y las cuerdas `#ffb3d1`, `#ff7a8a`, `#9fd8ff`, `#7aa8ff`. Cada color lleva su ratio medido en el comentario.

- [ ] **Step 3: Conmutador de tres**

Agregar `IconoContraste` (círculo medio lleno) a `app/componentes/iconos.tsx`. `ConmutadorTema` lee `document.documentElement.dataset.tema` al hacer clic, aplica `siguienteTema` y escribe la cookie. Para el ícono, usar las variantes: sol en oscuro, luna en claro y `IconoContraste` en alto; el nombre accesible dice «Cambiar el tema».

- [ ] **Step 4: Selector en «Más» simple**

`SelectorTema` es cliente: recibe `actual` del servidor (cookie leída en `MasPage`) y dibuja tres botones; al tocar, aplica el tema, escribe la cookie y actualiza `meta[name="theme-color"]`. Agregar la fila «Tema» al Más simple de `app/mas/page.tsx`.

- [ ] **Step 5: Verificar**

Run: `npm run build && npx eslint app/componentes/tema.ts app/componentes/conmutador-tema.tsx app/componentes/selector-tema.tsx`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add app/componentes/tema.ts app/componentes/conmutador-tema.tsx app/componentes/selector-tema.tsx app/globals.css app/mas/page.tsx
git commit -m "feat: tema de alto contraste"
```

---

### Task 12: Verificación completa

**Files:**
- No new files.

- [ ] **Step 1: Suite y build**

Run: `npm test && npm run build && npm run lint`
Expected: todo en verde.

- [ ] **Step 2: RLS local**

Run: `node --env-file=.env.development.local supabase/seed/verificar-rls.ts`
Expected: todos los actos en verde, incluidos los de `asistencia`.

- [ ] **Step 3: Playwright a 360 px**

Con el servidor en `:3002` y `musico@cantoral.local`. En este volumen `next dev` no ve los cambios: después de editar hay que detener el `next-server`, borrar `.next/dev` y volver a levantarlo antes de verificar.
1. La barra tiene «Mi misa · Misas · Más»; no hay «Canciones».
2. «Mi misa» muestra la misa inscrita (o la próxima) y «Voy / No voy»; al anotarse aparece la lista de quiénes van.
3. «Empezar» abre la lectura en 28 px, sin acordes, sin «Ensayar» ni transposición.
4. «Más» simple tiene Mi perfil, Mis coros, Tema, Lecturas del domingo y Volver a normal.
5. Prender «Lecturas del domingo» muestra las lecturas guardadas de la misa.
6. Alto contraste se mantiene al recargar.
7. «Normal» devuelve Inicio, Canciones y la barra completa.

- [ ] **Step 4: Director y admin**

Con `director@cantoral.local`: la app no cambia y no aparece «Modo simple» si no es miembro. Con `admin@cantoral.local`: nunca entra en simple.

- [ ] **Step 5: Commit final (si hubo ajustes)**

```bash
git add -A
git commit -m "test: verificación del modo simple"
```
