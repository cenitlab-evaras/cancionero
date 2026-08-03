-- =============================================================================
-- 02 · Preferencias de lectura  ·  H3 "Transponer y tamaño"
-- =============================================================================
-- Clase C (docs/PRD.md §7): tabla sensible con un predicado propio, más
-- estrecho que el alcance del coro. Cada uno ve SOLO las suyas — tampoco el
-- director, tampoco el admin (§8.2, fila `ver_preferencia_ajena` = no para los
-- tres roles).
--
-- Lo que NO está acá, a propósito: ninguna columna con el cifrado transpuesto.
-- Se guarda el NÚMERO de semitonos y el motor lo aplica al leer (decisión 10).
-- Un cifrado transpuesto persistido serían dos verdades del mismo número.
-- =============================================================================

create table if not exists cantoral.preferencias_lectura (
  id            uuid primary key default gen_random_uuid(),
  perfil_id     uuid not null references cantoral.perfiles(id) on delete cascade,
  canto_id      uuid not null references cantoral.cantos(id)   on delete cascade,
  -- Denormalizado: la preferencia cuelga del canto, que cuelga del coro.
  coro_id       uuid not null references cantoral.coros(id)    on delete cascade,
  transposicion integer not null default 0
                check (transposicion between -11 and 11),
  tamano_letra  integer not null default 16
                check (tamano_letra between 14 and 24 and tamano_letra % 2 = 0),
  updated_at    timestamptz not null default now(),
  unique (perfil_id, canto_id)
);

comment on column cantoral.preferencias_lectura.transposicion is
  'Semitonos, -11..11. RN-13: al llegar a ±12 el ciclo vuelve a 0, así que 12 no es un valor válido.';
comment on column cantoral.preferencias_lectura.tamano_letra is
  'RN-14: entre 14 y 24, en pasos de 2. Es un MÁXIMO: el ajuste de línea puede achicarlo para que entre en pantalla.';

create index if not exists preferencias_perfil_idx
  on cantoral.preferencias_lectura (perfil_id);

-- -----------------------------------------------------------------------------
-- RLS — clase C, predicado propio
-- -----------------------------------------------------------------------------

alter table cantoral.preferencias_lectura enable row level security;

-- Ver: solo las propias. Sin excepción para admin ni director.
drop policy if exists preferencias_select on cantoral.preferencias_lectura;
create policy preferencias_select on cantoral.preferencias_lectura
  for select using (perfil_id = auth.uid());

-- Escribir: solo las propias, y solo sobre un canto al que se tenga alcance.
-- El segundo predicado evita que alguien siembre preferencias de cantos de
-- otros coros, que sería una fuga por la puerta de atrás.
drop policy if exists preferencias_write on cantoral.preferencias_lectura;
create policy preferencias_write on cantoral.preferencias_lectura
  for all using (perfil_id = auth.uid() and cantoral.puede_ver_coro(coro_id))
          with check (perfil_id = auth.uid() and cantoral.puede_ver_coro(coro_id));
