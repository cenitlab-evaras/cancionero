-- =============================================================================
-- Vocabulario del producto — docs/PRD.md §5
--
-- §5 exige que cada cosa tenga UN nombre. Tres se habían corrido del habla real
-- del coro, y se corrigen acá, antes de construir nada encima:
--
--   1. Una «celebración» es una MISA. Es como la nombra el coro y como ya la
--      nombraba la cabecera desde el rediseño; faltaba que lo dijera la base.
--   2. Dentro de un coro hay DOS tipos de persona: director y MIEMBRO. La
--      palabra «músico» describía lo que hace, no lo que es.
--   3. Y por eso el rol GLOBAL deja de llamarse `miembro`: con el cambio 2,
--      `perfiles.rol = 'miembro'` y `coro_acceso.rol_local = 'miembro'`
--      significarían cosas distintas en la misma base. Pasa a `usuario`.
--
-- NADA DE ESTO CAMBIA UNA SOLA REGLA DE ACCESO. Es un renombre, y se escribe
-- para que se pueda leer como tal.
--
-- POR QUÉ RENOMBRAR UNA TABLA ES BARATO EN POSTGRES: `alter table … rename to`
-- conserva políticas, índices, restricciones, triggers y las claves foráneas
-- que apuntan a ella. No hay que rehacer la RLS. Lo único que queda con el
-- nombre viejo son los NOMBRES de esos objetos, y por eso se renombran abajo:
-- una política llamada `celebraciones_select` sobre la tabla `misas` es la
-- clase de detalle que dentro de seis meses hace dudar de si la migración
-- corrió entera.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1 · Celebración → misa
-- -----------------------------------------------------------------------------

alter table if exists public.celebraciones      rename to misas;
alter table if exists public.celebracion_cantos rename to misa_cantos;

alter table public.misa_cantos rename column celebracion_id to misa_id;

alter index if exists celebraciones_coro_idx              rename to misas_coro_idx;
alter index if exists celebraciones_coro_fecha_idx        rename to misas_coro_fecha_idx;
alter index if exists celebracion_cantos_orden_uk         rename to misa_cantos_orden_uk;
alter index if exists celebracion_cantos_coro_idx         rename to misa_cantos_coro_idx;
alter index if exists celebracion_cantos_celebracion_idx  rename to misa_cantos_misa_idx;

alter policy celebraciones_select      on public.misas       rename to misas_select;
alter policy celebraciones_write       on public.misas       rename to misas_write;
alter policy celebracion_cantos_select on public.misa_cantos rename to misa_cantos_select;
alter policy celebracion_cantos_write  on public.misa_cantos rename to misa_cantos_write;

comment on table public.misas is
  'Una misa con nombre y fecha (decisión 2). `fecha` es nullable a propósito: un ensayo o una lista de trabajo no tiene fecha — PRD §18-6, que este renombre vuelve más incómodo y sigue abierto.';
comment on table public.misa_cantos is
  'Un canto en un momento de una misa, con su orden. `coro_id` va denormalizado (decisión 8).';

-- -----------------------------------------------------------------------------
-- 2 · Músico → miembro, en el rol LOCAL
-- -----------------------------------------------------------------------------
-- El orden importa: primero se suelta el `check`, después se mueven los datos,
-- y recién entonces se vuelve a cerrar. Al revés, el `update` choca contra la
-- restricción que él mismo está por hacer válida.

alter table public.coro_acceso drop constraint if exists coro_acceso_rol_local_check;

update public.coro_acceso set rol_local = 'miembro' where rol_local = 'musico';

alter table public.coro_acceso
  add constraint coro_acceso_rol_local_check check (rol_local in ('director', 'miembro'));

comment on column public.coro_acceso.rol_local is
  'Los dos únicos tipos de persona del coro: el director arma el repertorio y las misas; el miembro lee y toca.';

-- -----------------------------------------------------------------------------
-- 3 · El rol GLOBAL `miembro` pasa a `usuario`
-- -----------------------------------------------------------------------------
-- No es cosmético: sin esto quedan dos columnas donde el valor 'miembro'
-- significa cosas distintas, que es justo lo que §5 prohíbe.
--
-- El `default` se suelta ANTES del `check`, porque Postgres valida el default
-- contra la restricción vigente y 'miembro' está por dejar de ser válido.
-- `crear_perfil_al_registrarse()` no se toca: inserta sin nombrar `rol` y toma
-- el default, así que cambiar el default alcanza.

alter table public.perfiles alter column rol drop default;
alter table public.perfiles drop constraint if exists perfiles_rol_check;

update public.perfiles set rol = 'usuario' where rol = 'miembro';

alter table public.perfiles alter column rol set default 'usuario';
alter table public.perfiles
  add constraint perfiles_rol_check check (rol in ('admin', 'usuario', 'externo'));

comment on column public.perfiles.rol is
  'Rol global: qué TIPO de cosas puede hacer alguien. `admin` es la cuenta de instalación, NO un tipo de persona del coro — eso lo dice coro_acceso.rol_local. `externo` es el valor con el que la sesión falla cerrado.';

-- -----------------------------------------------------------------------------
-- 4 · El coro se llama «Coro San José de la Familia»
-- -----------------------------------------------------------------------------
-- Va en la migración y no a mano por una razón concreta: `upsertCoro` de la
-- semilla busca el coro POR NOMBRE. Si el literal cambia antes que la fila, la
-- semilla crea un coro nuevo y vacío y deja el actual —con sus 87 cantos, sus
-- misas y sus miembros— huérfano. Versionado acá, el orden no depende de que
-- alguien se acuerde.

update public.coros
   set nombre = 'Coro San José de la Familia'
 where nombre = 'San José de la Familia';
