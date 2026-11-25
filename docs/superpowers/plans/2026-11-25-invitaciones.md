# Invitaciones y gobierno de coros — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el admin invite directores por email, cada director invite miembros de su coro, y que nadie entre a un coro sin una invitación aceptada.

**Architecture:** Tabla `invitacion` con token hasheado y RLS; dos RPC `security definer` para consultar y aceptar sin exponer la tabla; Supabase Auth manda el link por SMTP y `/auth/confirm` intercambia el código. Se cierran las puertas viejas (`agregarMiembro`, inserts directos a `coro_acceso`, roles locales por el director).

**Tech Stack:** Next.js 16 (App Router, Server Components, Route Handler), React 19, Supabase Auth + RLS, Tailwind 4, zod, vitest.

**Spec:** `docs/superpowers/specs/2026-11-25-invitaciones-design.md`

**Depende de:** nada de los otros planes; es la base de gobierno para el coro de la UGM.

## Global Constraints

- Código, comentarios y UI en español; la UI tutea.
- RLS activa en la misma migración; los casos nuevos van a `supabase/seed/verificar-rls.ts`.
- Motores puros en `lib/motores/`: sin Supabase, sin red, sin reloj; con `.test.ts`.
- El `SUPABASE_SECRET_KEY` solo en el servidor y solo en la action de invitar; nunca en el cliente.
- Objetivos táctiles de 44 px; nada de scroll horizontal a 360 px.
- `npm test`, `npm run build`, `npm run lint` en verde.
- Migraciones: local con `npm run db:reset`; producción a mano, fuera de este plan.
- RLS local: `node --env-file=.env.development.local supabase/seed/verificar-rls.ts` (nunca `.env.local`).
- El registro público de Supabase queda desactivado; la única puerta es la invitación.
- No tocar `../motor`, `../pruebas`, `../diseno`, `../assets` ni los PDF de `../docs/`.

## Review Focus

- **Director intentando crear un director:** tiene que fallar en la UI, en la action y en la RLS.
- **Inserción directa a `coro_acceso`:** un director no puede agregar a nadie sin invitación aceptada.
- **Email que no coincide:** un link reenviado a otro correo no puede aceptarse.
- **Director degradado:** aceptar una invitación de miembro no puede bajar a un director.
- **Cuenta existente:** la invitación usa link mágico y no crea una segunda cuenta.
- **SMTP caído:** la invitación queda pendiente y se puede reenviar; no se pierde.

---

### Task 1: Migración de invitaciones, RPC y cierre de `coro_acceso`

**Files:**
- Create: `supabase/migrations/20261125000300_invitaciones.sql`
- Modify: `supabase/seed/verificar-rls.ts`

**Interfaces:**
- Produces table `public.invitacion`, functions `aceptar_invitacion(p_hash text)` y `invitacion_publica(p_hash text)`, y las políticas nuevas de `coro_acceso`.

- [ ] **Step 1: Escribir la migración**

```sql
create table public.invitacion (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  coro_id     uuid not null references public.coros(id) on delete cascade,
  rol_local   text not null check (rol_local in ('director', 'miembro')),
  token_hash  text not null unique,
  creada_por  uuid not null references public.perfiles(id) on delete cascade,
  expira_en   timestamptz not null,
  aceptada_en timestamptz,
  created_at  timestamptz not null default now()
);

create unique index invitacion_pendiente_uk
  on public.invitacion (lower(email), coro_id)
  where aceptada_en is null;
create index invitacion_coro_idx on public.invitacion (coro_id, created_at desc);

alter table public.invitacion enable row level security;

create policy invitacion_select on public.invitacion
  for select using (
    public.es_admin()
    or exists (
      select 1 from public.coro_acceso a
       where a.coro_id = public.invitacion.coro_id
         and a.perfil_id = auth.uid()
         and a.rol_local = 'director'
    )
  );

create policy invitacion_insert on public.invitacion
  for insert with check (
    creada_por = auth.uid()
    and (
      (rol_local = 'director' and public.es_admin())
      or (
        rol_local = 'miembro'
        and exists (
          select 1 from public.coro_acceso a
           where a.coro_id = public.invitacion.coro_id
             and a.perfil_id = auth.uid()
             and a.rol_local = 'director'
        )
      )
    )
  );

create policy invitacion_update on public.invitacion
  for update using (
    public.es_admin()
    or exists (
      select 1 from public.coro_acceso a
       where a.coro_id = public.invitacion.coro_id
         and a.perfil_id = auth.uid()
         and a.rol_local = 'director'
    )
  )
  with check (
    public.es_admin()
    or exists (
      select 1 from public.coro_acceso a
       where a.coro_id = public.invitacion.coro_id
         and a.perfil_id = auth.uid()
         and a.rol_local = 'director'
    )
  );

create policy invitacion_delete on public.invitacion
  for delete using (
    public.es_admin()
    or exists (
      select 1 from public.coro_acceso a
       where a.coro_id = public.invitacion.coro_id
         and a.perfil_id = auth.uid()
         and a.rol_local = 'director'
    )
  );

create or replace function public.aceptar_invitacion(p_hash text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_inv public.invitacion; v_email text;
begin
  if auth.uid() is null then raise exception 'Entra primero'; end if;

  select email into v_email from public.perfiles where id = auth.uid();
  select * into v_inv
    from public.invitacion
   where token_hash = p_hash
     and aceptada_en is null
     and expira_en > now()
     and lower(email) = lower(v_email)
   for update;

  if not found then raise exception 'La invitación no es válida o venció'; end if;

  insert into public.coro_acceso (perfil_id, coro_id, rol_local)
  values (auth.uid(), v_inv.coro_id, v_inv.rol_local)
  on conflict (perfil_id, coro_id) do update
    set rol_local = case
      when public.coro_acceso.rol_local = 'director' then 'director'
      else excluded.rol_local
    end;

  update public.perfiles set aprobado = true where id = auth.uid();
  update public.invitacion set aceptada_en = now() where id = v_inv.id;
  return v_inv.coro_id;
end;
$$;

create or replace function public.invitacion_publica(p_hash text)
returns table (coro_nombre text, rol_local text)
language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if auth.uid() is null then raise exception 'Entra primero'; end if;
  select email into v_email from public.perfiles where id = auth.uid();
  return query
    select c.nombre, i.rol_local::text
      from public.invitacion i
      join public.coros c on c.id = i.coro_id
     where i.token_hash = p_hash
       and i.aceptada_en is null
       and i.expira_en > now()
       and lower(i.email) = lower(v_email)
     limit 1;
end;
$$;

revoke all on function public.aceptar_invitacion(text) from public, anon;
revoke all on function public.invitacion_publica(text) from public, anon;
grant execute on function public.aceptar_invitacion(text) to authenticated;
grant execute on function public.invitacion_publica(text) to authenticated;
grant select, insert, update, delete on public.invitacion to authenticated;

-- Puertas viejas: sin insert directo; solo el director toca miembros y solo el
-- admin toca filas de director.
drop policy if exists coro_acceso_write on public.coro_acceso;

create policy coro_acceso_update on public.coro_acceso
  for update using (
    public.es_admin()
    or (public.es_director_de(coro_id) and rol_local = 'miembro')
  )
  with check (
    public.es_director_de(coro_id)
    and (rol_local = 'miembro' or public.es_admin())
  );

create policy coro_acceso_delete on public.coro_acceso
  for delete using (
    public.es_admin()
    or (public.es_director_de(coro_id) and rol_local = 'miembro')
  );
```

- [ ] **Step 2: Aplicar en local**

Run: `npm run db:reset`
Expected: todas las migraciones aplican; la tabla y las funciones existen.

- [ ] **Step 3: Casos de RLS**

En `verificar-rls.ts`:
1. El admin inserta una invitación de `director`; espera éxito.
2. Un director intenta insertar `director`; espera error.
3. Un director inserta `miembro` en su coro; éxito; en otro coro, error.
4. Un miembro inserta cualquier invitación; error.
5. El invitado hace `select` de `invitacion`; 0 filas.
6. `invitacion_publica(hash)` con el email correcto devuelve el coro; con otro email, 0 filas.
7. `aceptar_invitacion(hash)` con el email correcto crea el `coro_acceso` y marca `aceptada_en`; repetir el mismo token falla.
8. Un director no puede insertar directo en `coro_acceso`; el admin sí puede actualizar/borrar filas de director.
Limpiar todo al final con el admin.

- [ ] **Step 4: Verificar RLS**

Run: `node --env-file=.env.development.local supabase/seed/verificar-rls.ts`
Expected: todos los actos en verde.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261125000300_invitaciones.sql supabase/seed/verificar-rls.ts
git commit -m "feat: invitaciones con RLS y aceptación"
```

---

### Task 2: Capacidades de invitación

**Files:**
- Modify: `lib/permisos.ts`
- Modify: `lib/permisos.test.ts`

**Interfaces:**
- `invitar_director`, `invitar_miembro`, `aceptar_invitacion` en `CAPACIDADES`.

- [ ] **Step 1: Test que falla**

```ts
test('solo el admin invita directores', () => {
  expect(puede({ rol: 'admin', aprobado: true, rolLocal: null }, 'invitar_director')).toBe(true)
  expect(puede({ rol: 'usuario', aprobado: true, rolLocal: 'director' }, 'invitar_director')).toBe(false)
})

test('invitar miembros exige dirigir el coro, incluso para el admin', () => {
  expect(puede({ rol: 'admin', aprobado: true, rolLocal: null }, 'invitar_miembro')).toBe(false)
  expect(puede({ rol: 'admin', aprobado: true, rolLocal: 'director' }, 'invitar_miembro')).toBe(true)
  expect(puede({ rol: 'usuario', aprobado: true, rolLocal: 'director' }, 'invitar_miembro')).toBe(true)
  expect(puede({ rol: 'usuario', aprobado: true, rolLocal: 'miembro' }, 'invitar_miembro')).toBe(false)
})
```

- [ ] **Step 2: Correr y verlo fallar**

Run: `npx vitest run lib/permisos.test.ts`
Expected: FAIL por capacidades desconocidas.

- [ ] **Step 3: Implementar**

Agregar las tres capacidades a `CAPACIDADES` y a la matriz:

- `admin`: `invitar_director: true`, `invitar_miembro: 'solo_director'`, `aceptar_invitacion: true`.
- `usuario`: `invitar_director: false`, `invitar_miembro: 'solo_director'`, `aceptar_invitacion: true`.
- `externo`: `invitar_director: false`, `invitar_miembro: false`, `aceptar_invitacion: true`.

- [ ] **Step 4: Correr y verlo pasar**

Run: `npx vitest run lib/permisos.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/permisos.ts lib/permisos.test.ts
git commit -m "feat: capacidades de invitación"
```

---

### Task 3: Datos, hash y acciones de invitación

**Files:**
- Create: `lib/motores/invitacion.ts`
- Test: `lib/motores/invitacion.test.ts`
- Create: `lib/datos/invitaciones.ts`
- Create: `app/invitaciones/acciones.ts`
- Modify: `.env.example`

**Interfaces:**
- ```ts
  export function normalizarEmail(email: string): string
  export function estaVencida(expiraEn: string, ahora: Date): boolean
  export type InvitacionPendiente = {
    id: string; email: string; rolLocal: 'director' | 'miembro'
    coroId: string; expiraEn: string; creadaEn: string
  }
  export async function invitacionesPendientes(coroId: string | null): Promise<InvitacionPendiente[]>
  export async function datosDeInvitacion(token: string): Promise<{ coroNombre: string; rolLocal: 'director' | 'miembro' } | null>
  ```
- Acciones: `invitarDirector`, `invitarMiembro`, `reenviarInvitacion`, `revocarInvitacion`, `aceptarInvitacion`.

- [ ] **Step 1: Test del motor**

```ts
import { describe, expect, test } from 'vitest'
import { estaVencida, normalizarEmail } from './invitacion'

test('normaliza el correo', () => {
  expect(normalizarEmail('  Juan.Perez@Coro.CL ')).toBe('juan.perez@coro.cl')
})

test('sabe si una invitación venció', () => {
  expect(estaVencida('2026-11-01T00:00:00Z', new Date('2026-11-02T00:00:00Z'))).toBe(true)
  expect(estaVencida('2026-11-03T00:00:00Z', new Date('2026-11-02T00:00:00Z'))).toBe(false)
})
```

- [ ] **Step 2: Implementar el motor**

`normalizarEmail` recorta y baja a minúsculas; `estaVencida` compara `Date.parse` con `ahora.getTime()`. Sin red ni Supabase.

- [ ] **Step 3: Datos**

`invitacionesPendientes(coroId)` consulta `invitacion` con `aceptada_en is null`, filtra por coro si llega un id, ordena por `created_at`; la RLS recorta. `datosDeInvitacion(token)` hashea con `crypto` y llama `.rpc('invitacion_publica', { p_hash })`; devuelve `null` si no hay fila.

- [ ] **Step 4: Acciones**

`app/invitaciones/acciones.ts` (`'use server'`):
- `tokenCrudo()`: `randomBytes(32).toString('hex')`; `hashToken()`: SHA-256 hex.
- `invitarDirector({ email, coroId })`: zod; sesión; `puede(invitar_director)`; genera token; inserta la fila con `creada_por: sesion.usuarioId`; si el insert da `23505`, «Ya hay una invitación pendiente para ese correo en ese coro»; envía el link.
- `invitarMiembro({ email })`: zod; sesión; `puede(invitar_miembro)` y `sesion.coroActivo?.rolLocal === 'director'`; coro activo; inserta; envía.
- `enviarLink(email, redirectTo)`: `createAdminClient()`; `auth.admin.inviteUserByEmail(email, { redirectTo })`; si falla, `auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: redirectTo } })`; devuelve error legible.
- `redirectTo`: `${SITE_URL}/auth/confirm?inv=${token}`; `SITE_URL` se lee de `process.env.SITE_URL`.
- `reenviarInvitacion(id)`: lee la fila (RLS), genera token nuevo, actualiza `token_hash`/`expira_en`, envía.
- `revocarInvitacion(id)`: delete por id (RLS).
- `aceptarInvitacion(token)`: sesión; `.rpc('aceptar_invitacion', { p_hash: hashToken(token) })`; si error, mensaje; `revalidatePath('/', 'layout')`; devuelve el coro.
- Todas devuelven `{ ok: true } | { ok: false; error: string }`.

- [ ] **Step 5: Env**

Agregar a `.env.example`:

```
SITE_URL=http://localhost:3000
```

- [ ] **Step 6: Verificar**

Run: `npx vitest run lib/motores/invitacion.test.ts && npm run build`
Expected: PASS y build limpio.

- [ ] **Step 7: Commit**

```bash
git add lib/motores/invitacion.ts lib/motores/invitacion.test.ts lib/datos/invitaciones.ts app/invitaciones/acciones.ts .env.example
git commit -m "feat: datos y acciones de invitación"
```

---

### Task 4: `/auth/confirm` y la pantalla de aceptación

**Files:**
- Create: `app/auth/confirm/route.ts`
- Create: `app/invitacion/page.tsx`
- Create: `app/invitacion/formulario.tsx`
- Modify: `supabase/config.toml`

**Interfaces:**
- `GET /auth/confirm?code=...&inv=...` deja la sesión y redirige a `/invitacion?inv=...`.
- `/invitacion?inv=<token>` muestra coro y rol, permite crear contraseña si la cuenta es nueva y aceptar.

- [ ] **Step 1: Route handler**

`app/auth/confirm/route.ts`:
- Lee `code` e `inv`.
- Crea un `NextResponse.redirect` a `/invitacion?inv=${inv}`.
- `createServerClient` con `getAll`/`setAll` que escriben las cookies en **response**.
- Si hay `code`, `await supabase.auth.exchangeCodeForSession(code)`.
- Si no hay `code` o falla, redirige a `/entrar`.

- [ ] **Step 2: Pantalla**

`app/invitacion/page.tsx`:
- `searchParams` → `inv`.
- `obtenerSesion()`; sin sesión: explica que abra el link del correo.
- `datosDeInvitacion(inv)`; si `null`: «La invitación no es válida o venció».
- `supabase.auth.getUser()` para `nuevo = !!user?.invited_at`.
- Muestra `coroNombre` y el rol («Entrarás como director/miembro»).
- `<FormularioInvitacion inv={inv} nuevo={nuevo} />`.

`formulario.tsx` (cliente):
- Si `nuevo`: campo contraseña + repetir (mínimo 8), `supabase.auth.updateUser({ password })`.
- Botón «Unirme al coro»: `aceptarInvitacion(inv)`; si `ok`, `router.replace('/')` y `router.refresh()`.
- Error visible con `role="alert"`.

- [ ] **Step 3: Config local**

En `supabase/config.toml`:
- `[auth] enable_signup = false`.
- `additional_redirect_urls` incluye `http://127.0.0.1:3000/auth/confirm` y `http://localhost:3000/auth/confirm`.
- `site_url` sigue siendo el de la app local.

- [ ] **Step 4: Verificar**

Run: `npm run build && npx eslint app/auth/confirm/route.ts app/invitacion`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add app/auth/confirm/route.ts app/invitacion supabase/config.toml
git commit -m "feat: link de invitación y pantalla de aceptación"
```

---

### Task 5: Admin invita directores

**Files:**
- Modify: `app/admin/perfiles/page.tsx`
- Modify: `app/admin/perfiles/panel.tsx`

**Interfaces:**
- `PanelAdmin` recibe `invitaciones: InvitacionPendiente[]`.
- Formulario «Invitar director» (email + coro) y lista de pendientes con reenviar/revocar.

- [ ] **Step 1: Página**

`admin/perfiles/page.tsx` suma `invitacionesPendientes(null)` al `Promise.all` y las pasa a `PanelAdmin`.

- [ ] **Step 2: Panel**

En `panel.tsx`, antes de «Cuentas»:
- Sección «Invitaciones a directores» con un `<select>` de coros (`coros`), un input `type="email"` y un botón «Invitar director»; llama `invitarDirector({ email, coroId })`.
- Lista de `invitaciones` pendientes: email, nombre del coro (buscado en `coros`), vencimiento y botones «Reenviar» y «Revocar» (`reenviarInvitacion`, `revocarInvitacion`).
- Mismo patrón de `correr()` y error que el resto del panel.

- [ ] **Step 3: Verificar**

Run: `npm run build && npx eslint app/admin/perfiles`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add app/admin/perfiles
git commit -m "feat: el admin invita directores"
```

---

### Task 6: Director invita miembros y se cierran las puertas viejas

**Files:**
- Modify: `app/coro/miembros/page.tsx`
- Modify: `app/coro/miembros/lista.tsx`
- Modify: `app/coro/acciones.ts`
- Create: `app/coro/miembros/invitar.tsx`

**Interfaces:**
- `ListaMiembros` pierde `disponibles`; recibe `invitaciones`.
- `invitarMiembro({ email })`.
- `quitarMiembro({ accesoId })` (nuevo).
- `agregarMiembro` se elimina; `cambiarRolLocal` queda **solo para el admin**.

- [ ] **Step 1: Acciones**

En `app/coro/acciones.ts`:
- Borrar `agregarMiembro`.
- `cambiarRolLocal`: además de `administrar_miembros`, exigir
  `sesion.sujeto.rol === 'admin'`; un director recibe «Solo el administrador
  cambia roles locales». La RLS de `coro_acceso` ya lo impide; esto devuelve el
  motivo.
- Agregar `quitarMiembro({ accesoId })`: sesión; `administrar_miembros`; lee la
  fila (RLS) y comprueba que sea de su coro activo y `rol_local = 'miembro'`
  salvo admin; delete; `revalidatePath('/coro/miembros')`.

- [ ] **Step 2: Página**

`miembros/page.tsx`: `Promise.all([perfilesConVinculo, fichasDelCoro, invitacionesPendientes(coro.id)])`; pasar `invitaciones` y quitar `disponibles` de `ListaMiembros`.

- [ ] **Step 3: Lista**

`lista.tsx`:
- Quitar el import de `agregarMiembro`/`cambiarRolLocal`, la sección «Disponibles» y el `<select>` de rol.
- Agregar `<Invitar correo={...} />` arriba de «En el coro».
- Agregar la lista de invitaciones pendientes con reenviar/revocar.
- El botón de quitar llama `quitarMiembro({ accesoId })`.

- [ ] **Step 4: `invitar.tsx`**

Cliente: email + botón «Invitar al coro»; llama `invitarMiembro({ email })`; muestra el error o «Invitación enviada»; `router.refresh()`.

- [ ] **Step 5: Verificar**

Run: `npm run build && npx eslint app/coro`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add app/coro
git commit -m "feat: el director invita miembros y no crea directores"
```

---

### Task 7: Configuración de correo y documentación

**Files:**
- Modify: `README.md` (o el doc de despliegue que corresponda)
- Modify: `.env.example`

- [ ] **Step 1: Documentar SMTP**

Agregar una sección «Invitaciones por email»:
- Supabase self-hosted (Dokploy): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ADMIN_EMAIL`, `SMTP_SENDER_NAME`.
- `SITE_URL` y `ADDITIONAL_REDIRECT_URLS` deben incluir el dominio de la app y `/auth/confirm`.
- Registro público desactivado.
- Local: Inbucket en `http://127.0.0.1:56324`.
- Sin SMTP no salen invitaciones; la app devuelve error y la fila queda pendiente para reenviar.

- [ ] **Step 2: Verificar**

Run: `grep -n "SMTP\|SITE_URL\|/auth/confirm" README.md .env.example`
Expected: las variables y la ruta aparecen.

- [ ] **Step 3: Commit**

```bash
git add README.md .env.example
git commit -m "docs: configuración de invitaciones por email"
```

---

### Task 8: Verificación completa

- [ ] **Step 1: Suite y build**

Run: `npm test && npm run build && npm run lint`
Expected: todo en verde.

- [ ] **Step 2: RLS local**

Run: `node --env-file=.env.development.local supabase/seed/verificar-rls.ts`
Expected: todos los actos en verde, incluidos los de Task 1.

- [ ] **Step 3: Flujo local con Inbucket**

Si el servidor corre en `:3002`, `SITE_URL` en `.env.development.local` debe ser
`http://localhost:3002`, y esa URL con `/auth/confirm` debe estar en
`additional_redirect_urls` del `config.toml` local. Inbucket queda en
`http://127.0.0.1:56324`.

1. Entrar como `admin@cantoral.local`, invitar un director a un coro.
2. Abrir `http://127.0.0.1:56324`, copiar el link.
3. Abrirlo sin sesión: crear contraseña, aceptar.
4. Verificar que entra al coro con rol director.
5. Entrar como ese director, invitar un miembro.
6. Repetir el link, aceptar, verificar el rol miembro.
7. Un director intenta invitar un director: la pantalla no lo ofrece.
8. Un miembro no ve «Invitar al coro».

- [ ] **Step 4: Playwright a 360 px**

Con el servidor en `:3002` y `admin@cantoral.local`:
1. `/admin/perfiles` muestra «Invitaciones a directores» y el formulario.
2. Con `director@cantoral.local`, `/coro/miembros` muestra «Invitar al coro» y no muestra «Disponibles» ni el selector de rol.
3. Con `musico@cantoral.local`, no aparece «Invitar».
4. El flujo de aceptación (Task 8, paso 3) se ve bien a 360 px.

- [ ] **Step 5: Commit final (si hubo ajustes)**

```bash
git add -A
git commit -m "test: verificación de invitaciones"
```
