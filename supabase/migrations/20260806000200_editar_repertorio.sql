-- =============================================================================
-- H8 · Editar el repertorio — docs/PRD.md §17, y RN-03 de docs/FUNCIONAL.md
--
-- H8 no crea tablas: `cantos` y `canto_momentos` existen desde H1 y su política
-- de escritura (`es_director_de(coro_id)`) ya estaba escrita esperando esto.
--
-- Lo que cambia son dos reglas que, con el repertorio entrando por la app en
-- vez de por la semilla, dejaron de servir tal como estaban.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · El director puede DAR DE ALTA un autor, no editar el catálogo
-- -----------------------------------------------------------------------------
-- `autores` es catálogo global de la instalación (clase D, decisión 6) y su
-- escritura era `es_admin()` entera. Con H8 eso traba el trabajo real: el
-- director carga un canto, el autor no está en el catálogo, y no puede seguir
-- sin que un admin intervenga.
--
-- Se parte en dos: dar de alta es del director de un coro; renombrar y borrar
-- siguen siendo del admin, porque tocan filas que otros coros ya están usando.

create or replace function public.es_director_de_algun_coro()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.coro_acceso ca
    join public.perfiles p on p.id = ca.perfil_id
    where ca.perfil_id = auth.uid()
      and ca.rol_local = 'director'
      and p.aprobado
  ) or public.es_admin()
$$;

grant execute on function public.es_director_de_algun_coro() to anon, authenticated, service_role;

drop policy if exists autores_write on public.autores;

drop policy if exists autores_insert on public.autores;
create policy autores_insert on public.autores
  for insert with check (public.es_director_de_algun_coro());

-- Renombrar o borrar un autor afecta a los cantos de OTROS coros que lo usan:
-- eso sigue siendo de la instalación, no de un director.
drop policy if exists autores_update on public.autores;
create policy autores_update on public.autores
  for update using (public.es_admin()) with check (public.es_admin());

drop policy if exists autores_delete on public.autores;
create policy autores_delete on public.autores
  for delete using (public.es_admin());

-- -----------------------------------------------------------------------------
-- 2 · Dos versiones del mismo canto, alineado con RN-03
-- -----------------------------------------------------------------------------
-- El índice anterior era `(coro_id, lower(titulo))`: más estricto que el
-- funcional heredado, que admite dos títulos iguales de autores distintos
-- (RN-03). §17.1 lo declaró como limitación conocida "que se revisa si aparece
-- el caso real de dos versiones del mismo canto". Con el repertorio entrando
-- por la app, aparece: el Santo de Gen Rosso y el de Palazón son dos cantos.
--
-- `coalesce` porque `autor_id` es nullable y en Postgres un índice único deja
-- pasar todos los NULL que quieras: sin esto, dos cantos anónimos con el mismo
-- título convivirían y la semilla dejaría de ser idempotente para ellos —que
-- son varios, porque el cancionero tiene muchos anónimos.

drop index if exists public.cantos_coro_titulo_uk;

create unique index if not exists cantos_coro_titulo_autor_uk
  on public.cantos (
    coro_id,
    lower(titulo),
    coalesce(autor_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
