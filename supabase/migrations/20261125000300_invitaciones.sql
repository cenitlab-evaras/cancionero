-- =============================================================================
-- Invitaciones y cierre de `coro_acceso`
-- Diseño: docs/superpowers/specs/2026-11-25-invitaciones-design.md
--
-- El gobierno del coro pasa a ser por invitación: el admin invita directores,
-- cada director invita a los miembros de SU coro, y nadie entra por otra puerta.
-- La tabla guarda el token hasheado; el token crudo viaja una sola vez en el
-- link y la base nunca lo ve.
-- =============================================================================

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

-- Una sola invitación PENDIENTE por email y coro: reenviar actualiza la que ya
-- está en vez de acumular links que valen todos. El índice es parcial porque
-- las aceptadas son historial y sí pueden repetirse.
create unique index invitacion_pendiente_uk
  on public.invitacion (lower(email), coro_id)
  where aceptada_en is null;

-- La lista de pendientes de un coro, que es lo que muestran las pantallas.
create index invitacion_coro_idx on public.invitacion (coro_id, created_at desc);

-- RLS activa en la misma migración que crea la tabla (regla del producto).
alter table public.invitacion enable row level security;

-- El admin ve todas las invitaciones; un director ve SOLO las de miembro de su
-- coro, para poder listarlas, reenviarlas o revocarlas. Las invitaciones de
-- director son del admin: si el director pudiera verlas, podría reescribir su
-- email o su token y nombrar directores por la puerta de atrás. El INVITADO no
-- lee la tabla: su correo y el token son de la RPC, no de una consulta directa
-- — así no puede enumerar quién más fue invitado ni qué hashes existen.
create policy invitacion_select on public.invitacion
  for select using (
    public.es_admin()
    or (
      exists (
        select 1 from public.coro_acceso a
        join public.perfiles p on p.id = a.perfil_id
         where a.coro_id = public.invitacion.coro_id
           and a.perfil_id = auth.uid()
           and a.rol_local = 'director'
           and p.aprobado
      )
      and public.invitacion.rol_local = 'miembro'
    )
  );

-- Crear la invitación:
--   · el admin puede invitar DIRECTORES (es la única puerta a un director);
--   · solo un director DEL CORO puede invitar MIEMBROS. No alcanza con ser
--     admin ni con `es_director_de` (que incluye al admin): se exige el vínculo
--     local `rol_local = 'director'`, que es la regla del dueño.
-- `creada_por = auth.uid()` impide firmar una invitación a nombre de otro.
create policy invitacion_insert on public.invitacion
  for insert with check (
    creada_por = auth.uid()
    and (
      (rol_local = 'director' and public.es_admin())
      or (
        rol_local = 'miembro'
        and exists (
          select 1 from public.coro_acceso a
          join public.perfiles p on p.id = a.perfil_id
           where a.coro_id = public.invitacion.coro_id
             and a.perfil_id = auth.uid()
             and a.rol_local = 'director'
             and p.aprobado
        )
      )
    )
  );

-- Reenviar o expirar una invitación PENDIENTE: el admin cualquiera; el director
-- solo las de MIEMBRO de su coro. El `using` mira la fila actual y el
-- `with check` la nueva: así un director no puede convertir su invitación de
-- miembro en una de director (sería nombrar un director sin el admin), no toca
-- las del admin y no reescribe una aceptada — aceptada es historia, no una
-- invitación que se pueda reenviar.
create policy invitacion_update on public.invitacion
  for update using (
    public.es_admin()
    or (
      exists (
        select 1 from public.coro_acceso a
        join public.perfiles p on p.id = a.perfil_id
         where a.coro_id = public.invitacion.coro_id
           and a.perfil_id = auth.uid()
           and a.rol_local = 'director'
           and p.aprobado
      )
      and public.invitacion.rol_local = 'miembro'
      and public.invitacion.aceptada_en is null
    )
  )
  with check (
    public.es_admin()
    or (
      exists (
        select 1 from public.coro_acceso a
        join public.perfiles p on p.id = a.perfil_id
         where a.coro_id = public.invitacion.coro_id
           and a.perfil_id = auth.uid()
           and a.rol_local = 'director'
           and p.aprobado
      )
      and public.invitacion.rol_local = 'miembro'
      and public.invitacion.aceptada_en is null
    )
  );

-- Revocar una invitación PENDIENTE: el admin cualquiera; el director solo las
-- de miembro de su coro. Así no puede tumbar en silencio el alta de un
-- director que decidió el admin ni borrar una aceptada (historia).
create policy invitacion_delete on public.invitacion
  for delete using (
    public.es_admin()
    or (
      exists (
        select 1 from public.coro_acceso a
        join public.perfiles p on p.id = a.perfil_id
         where a.coro_id = public.invitacion.coro_id
           and a.perfil_id = auth.uid()
           and a.rol_local = 'director'
           and p.aprobado
      )
      and public.invitacion.rol_local = 'miembro'
      and public.invitacion.aceptada_en is null
    )
  );

-- -----------------------------------------------------------------------------
-- Aceptación — la única puerta que escribe `coro_acceso` sin política de insert
-- -----------------------------------------------------------------------------
-- `security definer` porque el invitado todavía no es miembro y no puede leer
-- ni insertar por RLS. La función comprueba, en orden:
--   1. hay sesión;
--   2. el token existe, no venció, no se usó y el email de la invitación es el
--      del perfil autenticado (`perfiles.email`, que viene de auth);
--   3. el vínculo se crea o se actualiza.
--
-- El upsert NO degrada a un director: si ya era director del coro y acepta una
-- invitación de miembro, el `case` conserva el rol director. Ese es el riesgo
-- que el diseño señala con test.
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

-- Lo que la pantalla de aceptación muestra ANTES de unirse: el nombre del coro
-- y el rol. Solo responde si el hash es válido y el email coincide con la
-- sesión, así que no sirve para espiar invitaciones ajenas.
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

-- Sin `public` ni `anon`: nadie sin sesión puede probar hashes ni aceptar. Las
-- dos funciones solo se ejecutan con una sesión autenticada; `service_role`
-- queda igual que el resto de las funciones del repo, para pruebas y
-- herramientas del servidor.
revoke all on function public.aceptar_invitacion(text) from public, anon;
revoke all on function public.invitacion_publica(text) from public, anon;
grant execute on function public.aceptar_invitacion(text) to authenticated, service_role;
grant execute on function public.invitacion_publica(text) to authenticated, service_role;
grant select, insert, update, delete on public.invitacion to authenticated;

-- -----------------------------------------------------------------------------
-- Puertas viejas de `coro_acceso`: sin insert directo; solo el director toca
-- miembros y solo el admin toca filas de director.
-- -----------------------------------------------------------------------------
-- Se elimina `coro_acceso_write` (era FOR ALL). Sin reemplazo de INSERT: el
-- único insert legítimo es el de la RPC definer de arriba; la semilla y los
-- importadores usan el service role y no pasan por RLS. Si dejáramos una
-- política de insert, `agregarMiembro` podría volver por POST directo y el
-- gobierno por invitación se saltearía en dos toques.
drop policy if exists coro_acceso_write on public.coro_acceso;

-- Update: el `using` mira la fila ACTUAL, así que un director no puede tocar
-- una fila de director ni para degradarla — solo el admin. El `with check`
-- impide lo simétrico: un director no puede convertir a un miembro en director
-- (`rol_local = 'miembro' or public.es_admin()`) ni repuntar la fila a un
-- perfil sin aprobar o externo. Ese último guard es el de H7, que se conserva:
-- quitar la política FOR ALL no puede llevarse puesta la regla del alta.
create policy coro_acceso_update on public.coro_acceso
  for update using (
    public.es_admin()
    or (public.es_director_de(coro_id) and rol_local = 'miembro')
  )
  with check (
    public.es_director_de(coro_id)
    and (rol_local = 'miembro' or public.es_admin())
    and exists (
      select 1
        from public.perfiles p
       where p.id = perfil_id
         and p.aprobado
         and p.rol <> 'externo'
    )
  );

-- Delete: el director quita miembros; las filas de director solo las borra el
-- admin. Sin política de insert, como se explicó arriba.
create policy coro_acceso_delete on public.coro_acceso
  for delete using (
    public.es_admin()
    or (public.es_director_de(coro_id) and rol_local = 'miembro')
  );
