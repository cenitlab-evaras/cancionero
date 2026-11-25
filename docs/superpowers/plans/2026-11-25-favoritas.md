# Favoritas personales — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un miembro busque un canto del coro, lo ancle como favorito personal y lo tenga a un toque desde «Tus favoritas» en Mi misa.

**Architecture:** Tabla puente `canto_favorito` por persona y canto, con RLS de fila propia y de canto visible. Una pantalla `/favoritas` con buscador (URL `?q=`) reutiliza `buscarCantos` y el motor de búsqueda; una server action ancla y suelta. No toca la RLS del repertorio ni el modo.

**Tech Stack:** Next.js 16 (App Router), React 19, Supabase (RLS), Tailwind 4, zod, vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-25-modo-simple-design.md` (§6)

**Depende de:** `2026-11-25-modo-simple.md` ejecutado primero (usa `sesion.modo`, la lectura simple y `app/mi-misa.tsx`).

## Global Constraints

- Código, comentarios y UI en español; la UI tutea.
- RLS activa en la misma migración; los casos nuevos van a `supabase/seed/verificar-rls.ts`.
- La RLS manda: la pantalla no re-chequea permisos para decidir qué filas salen, pero la action sí valida forma y visibilidad antes de escribir.
- Objetivos táctiles de 44 px; nada de scroll horizontal a 360 px.
- `npm test`, `npm run build`, `npm run lint` en verde.
- Migraciones: local con `npm run db:reset`; producción a mano, fuera de este plan.
- Verificación RLS local: `node --env-file=.env.development.local supabase/seed/verificar-rls.ts`.

## Review Focus

- **Canto invisible para la persona:** la inserción tiene que fallar en la RLS, no solo esconderse en la UI.
- **Favorita de un canto archivado:** no debe aparecer en la lista, y no debe romper el `select`.
- **Cambio de coro:** la lista filtra por el coro activo; la fila no se borra.
- **Doble toque en «Anclar»:** el `upsert` no puede duplicar (PK) ni mostrar dos veces la fila.
- **Canto borrado después de anclado:** la foránea con `on delete cascade` limpia la favorita.

---

### Task 1: Tabla, RLS y verificación

**Files:**
- Create: `supabase/migrations/20261125000200_favoritas.sql`
- Modify: `supabase/seed/verificar-rls.ts`

**Interfaces:**
- Produces table `public.canto_favorito (perfil_id, canto_id, created_at)` con PK compuesta.

- [ ] **Step 1: Escribir la migración**

```sql
create table public.canto_favorito (
  perfil_id  uuid not null references public.perfiles(id) on delete cascade,
  canto_id   uuid not null references public.cantos(id)   on delete cascade,
  created_at timestamptz not null default now(),
  primary key (perfil_id, canto_id)
);

create index if not exists canto_favorito_perfil_idx
  on public.canto_favorito (perfil_id, created_at desc);

alter table public.canto_favorito enable row level security;

create policy canto_favorito_select on public.canto_favorito
  for select using (perfil_id = auth.uid());

create policy canto_favorito_insert on public.canto_favorito
  for insert with check (
    perfil_id = auth.uid()
    and exists (select 1 from public.cantos c where c.id = canto_id)
  );

create policy canto_favorito_delete on public.canto_favorito
  for delete using (perfil_id = auth.uid());

comment on table public.canto_favorito is
  'Favoritas personales de un canto (2026-11-25). Cada uno ve y escribe solo las suyas; la inserción exige que el canto sea visible por la RLS de cantos.';
```

- [ ] **Step 2: Aplicar en local**

Run: `npm run db:reset`
Expected: la migración aplica sin error.

- [ ] **Step 3: Casos de RLS**

En `verificar-rls.ts`, con `musico@`:
1. Insertar `{ perfil_id: user.id, canto_id: cantoVisible }` → sin error.
2. `select` de `canto_favorito` → devuelve 1 fila.
3. Con `ajeno@`, `select` → 0 filas.
4. Con `ajeno@`, insertar una favorita de un canto de San José → error (RLS).
5. Con `musico@`, borrar su favorita → 0 filas después.
Limpiar al final.

- [ ] **Step 4: Verificar**

Run: `node --env-file=.env.development.local supabase/seed/verificar-rls.ts`
Expected: los actos nuevos en verde.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261125000200_favoritas.sql supabase/seed/verificar-rls.ts
git commit -m "feat: tabla de favoritas con RLS"
```

---

### Task 2: Datos y server action

**Files:**
- Create: `lib/datos/favoritos.ts`
- Create: `app/favoritas/acciones.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Favorito = { id: string; titulo: string; autor: string | null }
  export async function favoritosDelCoro(coroId: string): Promise<Favorito[]>
  export async function anclarFavorito(
    cantoId: string,
    anclar: boolean
  ): Promise<{ ok: true } | { ok: false; error: string }>
  ```

- [ ] **Step 1: Consultas**

`favoritosDelCoro` consulta `canto_favorito` con `cantos!inner(id, titulo, autores(nombre), estado, coro_id)`, filtra `cantos.coro_id = coroId` y `cantos.estado <> 'archivado'`, y ordena por `created_at` descendente.

- [ ] **Step 2: Action**

```ts
'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { obtenerSesion } from '@/lib/sesion'
import { puede } from '@/lib/permisos'
import { obtenerCanto } from '@/lib/datos/repertorio'
```

Validar `cantoId` uuid y `anclar` boolean; sesión; `puede(sesion.sujeto, 'leer_canto')`. Si `anclar`, `obtenerCanto(cantoId)` debe existir (la RLS decide); si no, `{ ok: false, error: 'No tienes acceso a ese canto.' }`. Upsert `{ perfil_id: sesion.usuarioId, canto_id: cantoId }` con `onConflict: 'perfil_id,canto_id'`; si no, `delete().eq('perfil_id', ...).eq('canto_id', ...)`. `revalidatePath('/favoritas')` y `revalidatePath('/')`.

- [ ] **Step 3: Verificar**

Run: `npm run build && npx eslint lib/datos/favoritos.ts app/favoritas/acciones.ts`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add lib/datos/favoritos.ts app/favoritas/acciones.ts
git commit -m "feat: datos y action de favoritas"
```

---

### Task 3: Pantalla `/favoritas` y botón de anclar

**Files:**
- Create: `app/favoritas/page.tsx`
- Create: `app/favoritas/boton-favorito.tsx`
- Modify: `app/mi-misa.tsx` (enlace «Tus favoritas»)

**Interfaces:**
- `/favoritas?q=<término>`; `BotonFavorito({ cantoId, anclado }: { cantoId: string; anclado: boolean })`.

- [ ] **Step 1: Página**

Server Component:
- Sesión y redirects como el resto (`/entrar`, `/esperando-aprobacion`).
- Sin coro activo: estado vacío legítimo.
- `const q = (await searchParams).q?.trim() ?? ''`.
- `Promise.all([favoritosDelCoro(coro.id), q ? buscarCantos(coro.id, q, 20) : Promise.resolve([])])`.
- Título «Tus favoritas», enlace «Volver a Mi misa».
- Buscador GET (`name="q"`, `action="/favoritas"`), 44 px.
- Resultados: título, autor, `<BotonFavorito cantoId={...} anclado={...} />` y enlace a `/repertorio/[id]`.
- Ancladas: lista con enlace y `<BotonFavorito ... anclado />`.
- Vacíos que explican por qué (sin favoritas; sin resultados).

- [ ] **Step 2: Botón**

Cliente con `useOptimistic` y `useTransition`: alterna el texto «Anclar» / «Soltar», llama `anclarFavorito(cantoId, !anclado)` y, si falla, vuelve atrás y muestra el error en `role="alert"`. Área táctil de 44 px.

- [ ] **Step 3: Enlace desde Mi misa**

En `app/mi-misa.tsx`, debajo de la lista de cantos, un enlace «Tus favoritas» a `/favoritas` con el estilo de fila del producto.

- [ ] **Step 4: Verificar**

Run: `npm run build && npx eslint app/favoritas 'app/mi-misa.tsx'`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add app/favoritas 'app/mi-misa.tsx'
git commit -m "feat: pantalla de favoritas"
```

---

### Task 4: Verificación completa

- [ ] **Step 1: Suite y build**

Run: `npm test && npm run build && npm run lint`
Expected: todo en verde.

- [ ] **Step 2: RLS local**

Run: `node --env-file=.env.development.local supabase/seed/verificar-rls.ts`
Expected: todos los actos en verde.

- [ ] **Step 3: Playwright a 360 px (miembro)**

1. Entrar a «Mi misa», tocar «Tus favoritas».
2. Buscar un canto por título; anclarlo.
3. Verlo en la lista de ancladas; recargar y sigue.
4. Tocarlo: abre la lectura simple (28 px, sin acordes).
5. Soltarlo: desaparece y, al recargar, no vuelve.
6. Con un canto de otro coro (no visible), la búsqueda no lo devuelve.

- [ ] **Step 4: Commit final (si hubo ajustes)**

```bash
git add -A
git commit -m "test: verificación de favoritas"
```
