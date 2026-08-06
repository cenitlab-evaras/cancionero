-- =============================================================================
-- H7 · Gobernar el coro — docs/PRD.md §8.2 y §8.4
--
-- H7 no crea tablas: `perfiles`, `coros` y `coro_acceso` existen desde la
-- migración base, y sus políticas de escritura ya estaban escritas esperando
-- este hito (`perfiles_write: es_admin()`, `coro_acceso_write:
-- es_director_de()`).
--
-- Lo que SÍ hace falta es cerrar un hueco que se descubrió al construirlo.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · El orden del alta, hecho cumplir por la base
-- -----------------------------------------------------------------------------
-- §8.4 fija el orden: el admin APRUEBA el perfil → el director lo VINCULA.
--
-- La política anterior solo evaluaba a QUIEN ESCRIBE (`es_director_de(coro_id)`),
-- no al perfil que se está vinculando. Un director podía entonces agregar a su
-- coro a alguien todavía sin aprobar. Ese miembro no vería nada —`puede_ver_coro`
-- exige `aprobado`— pero quedaría en la lista como un fantasma, y el director
-- creería que ya lo habilitó.
--
-- Validarlo solo en la server action no alcanza: una action es alcanzable por
-- POST directo. La regla vive donde se decide de verdad (innegociable 2).

drop policy if exists coro_acceso_write on cantoral.coro_acceso;
create policy coro_acceso_write on cantoral.coro_acceso
  for all
  using (cantoral.es_director_de(coro_id))
  with check (
    cantoral.es_director_de(coro_id)
    and exists (
      select 1
      from cantoral.perfiles p
      where p.id = perfil_id
        and p.aprobado
        -- Una cuenta externa tiene entrada a la instalación, no membresía de
        -- coro. Mismo criterio que `puedeVincularse` en el motor.
        and p.rol <> 'externo'
    )
  );

-- -----------------------------------------------------------------------------
-- 2 · Un coro no se queda sin director en silencio
-- -----------------------------------------------------------------------------
-- No es una restricción de la base —un coro recién creado no tiene ninguno y
-- eso es legítimo—, sino un dato que la pantalla de miembros necesita para
-- avisar antes de que el último director se degrade a músico y nadie pueda
-- volver a armar una misa.
--
-- Se expone como función y NO como columna: el número de directores es un
-- derivado, y un derivado guardado es un derivado que algún día miente
-- (innegociable 4).

create or replace function cantoral.directores_de(p_coro_id uuid)
returns integer
language sql
stable
security definer
set search_path = cantoral, public
as $$
  select count(*)::integer
  from cantoral.coro_acceso ca
  join cantoral.perfiles p on p.id = ca.perfil_id
  where ca.coro_id = p_coro_id
    and ca.rol_local = 'director'
    and p.aprobado
$$;

grant execute on function cantoral.directores_de(uuid) to anon, authenticated, service_role;
