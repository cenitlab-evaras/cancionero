-- =============================================================================
-- H17 · Sugerencias y ranking — docs/PRD.md §17, §19.2-B9 y §19.5
--
-- «Un ranking donde cada miembro sugiere alguna canción para determinado
--  momento de la misa, y el director puede escoger la que más se repite o la
--  que más se quiere cantar.»
--
-- Segunda escritura del miembro en dato compartido. La regla es la misma que
-- abrió H15 y no se mueve: escribe SOLO filas suyas, las lee todo el coro.
--
-- `misa_id` ES NULLABLE Y ESO ES LA DECISIÓN DEL HITO (2026-09-03). Sin misa,
-- la sugerencia es una propuesta general para un momento: «para Comunión
-- propongo este». Con misa, es para ese domingo. El dueño pidió las dos, sabiendo
-- que duplica pantallas. Lo que NO se hace es rankearlas juntas: contestan
-- preguntas distintas —«qué quiere cantar el coro» y «qué pedimos para el
-- domingo»— y sumarlas daría un número que no significa ninguna de las dos.
-- Se muestran en dos bloques separados; ver el motor `sugerencia`.
-- =============================================================================

create table if not exists public.sugerencia (
  perfil_id  uuid not null,
  canto_id   uuid not null,
  momento_id uuid not null references public.momentos_liturgicos(id) on delete restrict,
  coro_id    uuid not null references public.coros(id) on delete cascade,

  -- NULL = propuesta general para el momento. No NULL = para esa misa.
  misa_id    uuid,

  created_at timestamptz not null default now(),

  constraint sugerencia_perfil_fk
    foreign key (perfil_id) references public.perfiles(id) on delete cascade
);

comment on table public.sugerencia is
  'H17. Una persona proponiendo un canto para un momento. `misa_id` nullable: sin misa es una propuesta general del coro; con misa es para ese domingo. Las dos NO se suman en un mismo ranking (PRD §17).';
comment on column public.sugerencia.misa_id is
  'NULL = propuesta general para el momento. No nulo = propuesta para esa misa.';

-- -----------------------------------------------------------------------------
-- Sin duplicados, y con la trampa de los NULL resuelta
-- -----------------------------------------------------------------------------
-- Un `unique (perfil_id, canto_id, momento_id, misa_id)` NO alcanza: en Postgres
-- dos NULL no son iguales entre sí, así que la misma persona podría proponer el
-- mismo canto para el mismo momento tantas veces como quisiera mientras
-- `misa_id` fuera nulo — que es justo el caso general, el más usado, y el que
-- inflaría el ranking sin que nadie se diera cuenta.
--
-- Dos índices parciales lo cierran: uno para las generales y otro para las de
-- misa.

create unique index if not exists sugerencia_general_uk
  on public.sugerencia (perfil_id, canto_id, momento_id)
  where misa_id is null;

create unique index if not exists sugerencia_de_misa_uk
  on public.sugerencia (perfil_id, canto_id, momento_id, misa_id)
  where misa_id is not null;

-- El ranking se lee por coro y por momento; y por misa cuando se arma esa misa.
create index if not exists sugerencia_coro_momento_idx
  on public.sugerencia (coro_id, momento_id);
create index if not exists sugerencia_misa_idx
  on public.sugerencia (misa_id)
  where misa_id is not null;

-- -----------------------------------------------------------------------------
-- Integridad entre coros — con la lección de H15 aplicada de entrada
-- -----------------------------------------------------------------------------
-- Igual que en `misa_participante`, `coro_id` va denormalizado y lo escribe el
-- MIEMBRO. Sin más, podría mandar su propio coro junto con el canto o la misa de
-- otro: los predicados de la política pasan y el coro ajeno vería una sugerencia
-- que no es suya. Dos foráneas compuestas lo vuelven imposible.
--
-- Y OJO CON LO QUE SE APRENDIÓ HOY: las columnas `canto_id` y `misa_id` NO
-- declaran su propia foránea simple. Declarar las dos —la simple y la
-- compuesta— deja dos relaciones entre las mismas tablas, y PostgREST no puede
-- resolver un embed con dos: devuelve `PGRST201` y la pantalla no carga. Pasó
-- con `misa_participante` en este mismo día. La compuesta sola alcanza: ambas
-- columnas del par son NOT NULL en el caso del canto, y en el de la misa la
-- foránea solo se evalúa cuando `misa_id` no es nulo (MATCH SIMPLE).

create unique index if not exists cantos_id_coro_uk on public.cantos (id, coro_id);

alter table public.sugerencia
  drop constraint if exists sugerencia_canto_del_mismo_coro;
alter table public.sugerencia
  add constraint sugerencia_canto_del_mismo_coro
  foreign key (canto_id, coro_id) references public.cantos (id, coro_id) on delete cascade;

alter table public.sugerencia
  drop constraint if exists sugerencia_misa_del_mismo_coro;
alter table public.sugerencia
  add constraint sugerencia_misa_del_mismo_coro
  foreign key (misa_id, coro_id) references public.misas (id, coro_id) on delete cascade;

-- -----------------------------------------------------------------------------
-- RLS — activa en la MISMA migración que crea la tabla
-- -----------------------------------------------------------------------------

alter table public.sugerencia enable row level security;

-- Lee todo el coro, CON los nombres: «la que más se quiere cantar» es un dato
-- social, y esconder quién propuso qué lo convierte en un buzón.
drop policy if exists sugerencia_select on public.sugerencia;
create policy sugerencia_select on public.sugerencia
  for select using (public.puede_ver_coro(coro_id));

-- Escribe SOLO la fila propia. §19.5, la misma regla que abrió H15.
-- El director tampoco propone por otro; sí puede proponer lo suyo, como
-- cualquiera, y además es el único que asigna cantos a la misa (§8.2).
drop policy if exists sugerencia_write on public.sugerencia;
create policy sugerencia_write on public.sugerencia
  for all
  using      (perfil_id = auth.uid() and public.puede_ver_coro(coro_id))
  with check (perfil_id = auth.uid() and public.puede_ver_coro(coro_id));
