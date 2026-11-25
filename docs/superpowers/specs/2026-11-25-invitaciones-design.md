# Invitaciones y gobierno de coros — diseño

**2026-11-25** · Cantoral · el dueño eligió la opción A: **invitación de Supabase
por email** (link para poner contraseña), con SMTP configurado.

## Intención

Hoy las cuentas se crean fuera de la app (semilla o admin), el admin aprueba
perfiles y el director agrega perfiles existentes a su coro. El dueño quiere un
gobierno por invitación: **el administrador invita a los directores**, cada
**director invita por email a los miembros de su coro**, y no hay miembro sin la
invitación de un director ni director sin el administrador.

Esto es la base para que la Universidad Gabriela Mistral tenga su coro: el admin
la dirige, invita a su director, y ese director invita a sus cantantes.

## Objetivos

1. **Admin → directores:** el admin invita por email a un director a un coro.
2. **Director → miembros:** cada director invita por email a los miembros de su
   coro.
3. **Sin auto-registro:** la única puerta a una cuenta es una invitación.
4. **Aceptación clara:** el invitado abre el link, crea su contraseña (si es
   nuevo), ve a qué coro y con qué rol lo invitan, y acepta.
5. **Trazable:** quién invitó, a qué coro, con qué rol, cuándo vence y cuándo se
   aceptó.

## No objetivos

- No cambia la edición del repertorio ni las misas.
- No es un sistema de invitaciones genérico para cualquier recurso: es
  coro + rol local.
- No hay invitación de un director a otro director: eso es del admin.
- No se toca la marca por coro (UGM) en este diseño; la pantalla de invitación
  puede mostrar el nombre del coro invitante, pero el skin es otro proyecto.
- No se cambia el login genérico de la app; la identidad por coro antes de entrar
  queda para el diseño multi-coro.

## Estado actual que se reemplaza

- `auth.users` crea un `perfiles` con `aprobado = false` (trigger
  `crear_perfil_al_registrarse`).
- El admin aprueba perfiles (`aprobar_perfil`) y crea coros.
- El director, en `Miembros`, elige **perfiles ya existentes** y les da rol local.
- **No hay email** ni invitaciones; `/entrar` solo inicia sesión.

Con este diseño, el flujo de «elegir perfiles» desaparece para los miembros: se
invita por correo. La aprobación manual queda solo como legado/admin.

## Diseño

### 1. Capacidades

En `lib/permisos.ts`:

- **`invitar_director`**: `admin: true`; `usuario: false`; `externo: false`.
- **`invitar_miembro`**: `admin: 'solo_director'` (un admin que además dirige el
  coro puede invitar; uno suelto no), `usuario: 'solo_director'`;
  `externo: false`.
- **`aceptar_invitacion`**: `true` para cualquier persona autenticada.

La UI y las actions comprueban la capacidad. La RLS vuelve a decidir.

**Regla del dueño:** el admin invita directores; los miembros los invita un
director **del coro**. Aunque el admin sea `es_director_de` por su rol global, la
invitación de un miembro exige que su `coro_acceso.rol_local` sea `director`: la
action lo comprueba además de la capacidad, y la RLS de `invitacion` lo exige
para el insert de `rol_local = 'miembro'`.

### 2. La tabla `invitacion`

```sql
create table public.invitacion (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  coro_id     uuid not null references public.coros(id) on delete cascade,
  rol_local   text not null check (rol_local in ('director', 'miembro')),
  token_hash  text not null,
  creada_por  uuid not null references public.perfiles(id) on delete cascade,
  expira_en   timestamptz not null,
  aceptada_en timestamptz,
  created_at  timestamptz not null default now()
);

create unique index invitacion_pendiente_uk
  on public.invitacion (lower(email), coro_id)
  where aceptada_en is null;

create index invitacion_coro_idx on public.invitacion (coro_id, created_at desc);
```

- El token se genera en el servidor (32 bytes), se guarda **hasheado**
  (SHA-256) y viaja una sola vez en el link.
- Vence a los 7 días; una invitación aceptada no se reutiliza.
- Si se reenvía, se actualiza el token y la fecha de la pendiente.

### 3. RLS de `invitacion`

- **Select:** el admin ve todas; un director ve las de su coro (para la lista de
  pendientes). El invitado **no** lee la tabla directamente.
- **Insert:** `creada_por = auth.uid()` y
  - `rol_local = 'director'` y `es_admin()`, o
  - `rol_local = 'miembro'` y existe un `coro_acceso` propio con
    `coro_id = invitacion.coro_id` y `rol_local = 'director'`.
- **Update:** solo para reenviar/expirar; el admin o el director del coro.
- **Delete:** el admin o el director del coro (revocar una invitación pendiente).
- Sin acceso del invitado: la aceptación va por función.

### 4. Aceptación: RPC `security definer`

El servidor hashea el token del link (SHA-256) antes de llamar; la base nunca ve
el token crudo y no necesita `pgcrypto`.

```sql
create or replace function public.aceptar_invitacion(p_hash text)
returns uuid
language plpgsql security definer set search_path = public as $$
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

revoke all on function public.aceptar_invitacion(text) from public, anon;
grant execute on function public.aceptar_invitacion(text) to authenticated;
```

- El email del perfil (que viene de `auth.users`) tiene que coincidir con el de
  la invitación.
- Ser miembro de otro coro no impide aceptar: el `upsert` agrega el vínculo.
- Si ya era director del coro, una invitación de miembro **no lo degrada**; el
  `case` lo conserva. Hay test.
- Una segunda función, también definer, `invitacion_publica(p_hash)` devuelve
  `{coro_nombre, rol_local}` solo si el email coincide con la sesión, para que la
  pantalla de aceptación muestre el coro sin ser miembro.

### 5. Cerrar las puertas viejas (obligatorio)

Sin esto, el gobierno por invitación se saltea en dos toques:

- **`agregarMiembro`** (`app/coro/acciones.ts`) deja de existir, y la lista de
  «disponibles» de `app/coro/miembros/lista.tsx` se retira. Un miembro entra solo
  por invitación.
- **`coro_acceso_write`** se parte:
  - **Insert:** se elimina la política; nadie autenticado inserta directamente.
    El único insert es el de la RPC definer. La semilla y los importadores usan
    el service role y no pasan por acá.
  - **Update:** el director puede actualizar filas de su coro, pero **solo el
    admin** puede dejar `rol_local = 'director'` (with check
    `rol_local = 'miembro' or es_admin()`).
  - **Delete:** el director borra miembros; las filas de director solo las borra
    el admin.
- **`cambiarRolLocal`**: solo el admin puede promover o degradar directores. El
  director ya no tiene ese control en su pantalla; eso también cierra «director
  creado sin el admin». La action comprueba el rol global (`admin`) además de la
  capacidad.
- La página del admin (`app/admin/perfiles/panel.tsx`) conserva el cambio de rol
  y suma la invitación de directores.

```sql
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
-- Sin política de insert: el único insert directo es el de la RPC definer.
```

El `using` mira la fila **actual**: un director no puede tocar una fila de
director, ni para degradarla. Solo el admin. El `with check` impide que un
director convierta un miembro en director.
```

### 6. Crear la invitación

**Server action** `app/invitaciones/acciones.ts`:

- `invitarDirector({ email, coroId })`: exige `invitar_director` (admin).
- `invitarMiembro({ email })`: exige `invitar_miembro` y que el rol local en el
  coro activo sea `director`.
- Valida email (zod), normaliza a minúsculas, comprueba que el coro exista y que
  no haya una invitación pendiente para ese email/coro.
- Inserta la `invitacion` con la sesión del que invita (la RLS decide) y el token
  hasheado.
- Manda el email con el **cliente admin de Supabase**
  (`lib/supabase/admin.ts`, `SUPABASE_SECRET_KEY`), que es la única forma de
  `inviteUserByEmail`. Es una excepción deliberada a «el secreto solo en semilla
  e importadores»: la action valida capacidad y coro antes de usarlo, y nunca
  corre en el cliente.
  - Cuenta nueva: `auth.admin.inviteUserByEmail(email, { redirectTo })`.
  - Cuenta existente: `auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo } })`
    (link mágico).
  - `redirectTo`: `${SITE_URL}/auth/confirm?inv=${token}`.
- Nueva variable **`SITE_URL`** en `.env.example` y en el entorno de producción
  (para el `redirectTo` absoluto). En local, `http://localhost:3000`.
- Si el email falla, la fila queda pendiente y la action devuelve el error para
  reintentar. No se «acepta» una invitación sin email.

### 7. El link, la contraseña y la aceptación

1. Supabase verifica el link y redirige a `/auth/confirm?code=...&inv=...`.
2. `app/auth/confirm/route.ts` intercambia el código (`exchangeCodeForSession`),
   deja la sesión en cookies y redirige a `/invitacion?inv=...&nuevo=1` si el
   tipo era invitación.
3. `/invitacion` (Server Component + isla cliente):
   - Sin sesión: explica que el link venció o que entre desde el correo.
   - Con sesión: la action hashea el token y `invitacion_publica(hash)` muestra el
     coro y el rol.
   - Si es cuenta nueva: un formulario para crear la contraseña
     (`supabase.auth.updateUser({ password })`), mínimo 8 caracteres.
   - Botón **«Unirme al coro»** → action que hashea el token y llama a
     `aceptar_invitacion(hash)`.
   - Al aceptar, redirige a `/`; `rutaInicial` lleva al coro.
   - Si la invitación venció o el email no coincide: mensaje claro y salida.

### 8. Email: configuración (prerrequisito de operación)

- **Supabase self-hosted** (Dokploy): configurar SMTP en el servicio de Auth
  (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_ADMIN_EMAIL`,
  `SMTP_SENDER_NAME`), `SITE_URL` y `ADDITIONAL_REDIRECT_URLS` con el dominio de
  la app y `/auth/confirm`.
- **Proveedor recomendado:** Resend por SMTP con el dominio de la app; SPF y DKIM
  en el DNS. Sin eso, los correos no salen o caen en spam.
- **Local:** el stack de Supabase captura los correos (Inbucket); se prueba el
  link sin proveedor real.
- **Plantillas:** la de «Invite user» de Supabase, con el nombre de la app y el
  botón al link. No se manda el PDF ni datos del coro en el correo.
- **Registro público desactivado** en Supabase Auth (`disable_signup`), porque la
  única puerta es la invitación.

### 9. Pantallas

**Admin — Usuarios (`app/admin/perfiles/panel.tsx`):**
- En cada coro, «Invitar director» (email) y la lista de invitaciones pendientes
  con «Reenviar» y «Revocar».
- El admin sigue creando coros como hoy.
- El cambio de rol local (promover/degradar director) queda acá, solo para el
  admin.

**Director — Miembros (`app/coro/miembros/page.tsx` y `lista.tsx`):**
- Arriba, «Invitar al coro» (email). Debajo, miembros actuales y invitaciones
  pendientes (con reenviar/revocar).
- Se **quita** la lista de «disponibles» (perfiles existentes sin vínculo): un
  miembro entra por invitación, no por selección.
- El director puede quitar a un miembro. **No** cambia roles locales ni crea
  directores: eso es del admin.

**Login:** sin cambios en este diseño. La pantalla de invitación sí muestra el
coro invitante.

### 10. Legado y semilla

- La semilla y los importadores siguen usando el service role; no pasan por
  invitaciones.
- Los perfiles sin coro (`aprobado = false`) siguen existiendo; el admin puede
  aprobarlos como legado, pero el camino nuevo es invitarlos.
- El `aprobar_perfil` no se borra; deja de ser el camino principal.

## Verificación

- RLS local:
  - El admin inserta una invitación de director; un director **no**.
  - Un director inserta una invitación de miembro en su coro; no en otro.
  - Un miembro no inserta invitaciones.
  - El invitado no puede leer `invitacion`.
  - `aceptar_invitacion`: token válido + email correcto crea el `coro_acceso` y
    aprueba el perfil; email distinto, token vencido o repetido fallan.
  - Un director **no** inserta directo en `coro_acceso` (sin política de insert).
  - Un director **no** convierte un miembro en director ni degrada a un director;
    el admin sí.
  - Un director **no** borra una fila de director; el admin sí.
- Tests puros: normalización de email, expiración, rol resultante (no degradar
  director a miembro).
- Flujo local con Inbucket: admin invita director → link → contraseña → acepta →
  entra al coro; director invita miembro → link → acepta.
- Con una cuenta ya existente: link mágico y aceptación sin crear otra cuenta.
- Playwright a 360 px: admin y director ven sus invitaciones; el miembro no ve
  «Invitar».
- `tsc`, `eslint`, `npm test`, `npm run build`.

## Riesgos y cuidados

- **SMTP no configurado:** sin él no sale ningún correo. Es un prerrequisito de
  producción; la app muestra un error claro si el envío falla.
- **Signups abiertos:** si Supabase permite registro público, alguien podría
  crearse una cuenta sin invitación. Se desactiva y se prueba.
- **Service role en una action:** solo la action de invitar lo usa, detrás de
  capacidad y coro; nunca en el cliente ni en una ruta pública.
- **Token en la URL:** se guarda hasheado, vence y es de un solo uso; no se
  registra en logs.
- **Director degradado:** aceptar una invitación de miembro no puede bajar a un
  director; el `case` del `upsert` lo impide y hay test.
- **Correo equivocado:** el link solo sirve para el email del perfil autenticado;
  reenviar a otro correo exige una invitación nueva.

## Pendiente, fuera de este diseño

- Multi-coro con look and feel UGM y login por coro.
- Carga de cantos del admin (diseño ya escrito).
- Modo simple (planes ya escritos).
- OCR de PDFs y Configuración en cajas.
- ExtraHosts de producción.
