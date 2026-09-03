-- =============================================================================
-- H15 · Inscripción a la misa — docs/PRD.md §17, §19.2-B2 y §19.5
--
-- «Un segmento donde cada integrante del coro puede inscribirse en la misa
--  donde va a querer cantar o va a poder cantar, para poder ordenar el coro con
--  las voces y con los instrumentos.»
--
-- ES LA PRIMERA ESCRITURA DE UN MIEMBRO EN DATO QUE EL CORO ENTERO LEE. Hasta
-- hoy el miembro solo escribía filas invisibles para el resto: su transposición
-- (H3), su preferencia de lectura (H11), su perfil (H14). §19.5 decidió la
-- regla el 2026-08-06 —escribe solo filas suyas— y dejó dicho que se escribía
-- «el día que se construya H15, no antes». Este es ese día.
--
-- LEEN TODOS, y no solo el director (decidido el 2026-09-03): ver que ya hay
-- tres anotados empuja a anotarse, y ver que no hay nadie avisa a tiempo. Es la
-- diferencia deliberada con `preferencias_perfil` (H11) y `ficha_miembro`
-- (H14), donde nadie ve nada ajeno.
-- =============================================================================

create table if not exists public.misa_participante (
  misa_id     uuid not null references public.misas(id)    on delete cascade,
  perfil_id   uuid not null references public.perfiles(id) on delete cascade,
  coro_id     uuid not null references public.coros(id)    on delete cascade,

  -- UN campo condicional, no dos sueltos (§19.2-B2, textual: «se inclinan
  -- también con voz, instrumento, y si es con instrumento, tiene que definir
  -- cuál»). El `check` de abajo es lo que lo vuelve un campo y no dos.
  --
  -- Se llama `vocal`/`instrumental` y no «voz»: §19.4 prohíbe «voz» como
  -- nombre de nada —en el habla del coro significa a la vez la tesitura y la
  -- pista grabada— y «canto» ya es la otra tabla.
  aporte      text not null check (aporte in ('vocal', 'instrumental')),
  instrumento text check (instrumento in
                ('guitarra', 'teclado', 'bajo', 'percusion', 'flauta', 'violin', 'otro')),

  created_at  timestamptz not null default now(),

  -- Una sola inscripción por persona y misa. Cambiar de opinión es un update,
  -- no una segunda fila.
  primary key (misa_id, perfil_id),

  constraint instrumento_solo_si_toca check (
    (aporte = 'instrumental' and instrumento is not null) or
    (aporte = 'vocal'        and instrumento is null)
  )
);

comment on table public.misa_participante is
  'H15. Quién va a una misa y con qué aporta. La escribe cada quien —solo su fila— y la lee todo el coro. La TESITURA no está acá: vive en ficha_miembro (H14), y pedirla dos veces crearía dos verdades.';

-- El coro lee «quién va a esta misa»: se indexa como se lee.
create index if not exists misa_participante_misa_idx on public.misa_participante (misa_id);
create index if not exists misa_participante_coro_idx on public.misa_participante (coro_id);

-- -----------------------------------------------------------------------------
-- El agujero que hay que cerrar ANTES de abrir la escritura al miembro
-- -----------------------------------------------------------------------------
-- `coro_id` va denormalizado, como manda la decisión 8 y como ya hacen
-- `misa_cantos` y `canto_momentos`. Pero hay una diferencia que lo cambia todo:
-- esas filas las escribe el DIRECTOR. Estas las escribe el miembro, desde su
-- teléfono, con la petición que él arma.
--
-- Con la política de abajo y nada más, un miembro de este coro podría mandar su
-- propio `coro_id` —que sí puede ver— junto con el `misa_id` de una misa de
-- OTRO coro. Los dos predicados pasan, la fila entra, y el coro ajeno ve un
-- inscrito que no es suyo.
--
-- Se cierra declarativamente y sin trigger: con una foránea compuesta, un
-- `coro_id` que no sea el de la misa es IMPOSIBLE, no improbable.
--
-- (`misa_cantos` tiene la misma grieta latente. Hoy es inofensiva porque solo
--  escribe el director, y queda DECLARADA como pendiente en §17 — no corregida
--  en silencio ni omitida.)

create unique index if not exists misas_id_coro_uk on public.misas (id, coro_id);

alter table public.misa_participante
  drop constraint if exists participante_misa_del_mismo_coro;
alter table public.misa_participante
  add constraint participante_misa_del_mismo_coro
  foreign key (misa_id, coro_id) references public.misas (id, coro_id) on delete cascade;

-- -----------------------------------------------------------------------------
-- RLS — activa en la MISMA migración que crea la tabla
-- -----------------------------------------------------------------------------

alter table public.misa_participante enable row level security;

-- Ver: todo el coro. La función de este dato es que el coro se vea a sí mismo.
drop policy if exists misa_participante_select on public.misa_participante;
create policy misa_participante_select on public.misa_participante
  for select using (public.puede_ver_coro(coro_id));

-- Escribir: SOLO la fila propia, y solo en un coro al que ya se pertenece.
-- §19.5, literal: «el músico escribe solo filas suyas».
--
-- El segundo predicado no es teatro: sin él, cualquiera sembraría inscripciones
-- suyas en coros donde no entró. `puede_ver_coro` exige pertenencia aprobada,
-- que es el portón de §8.4.
--
-- EL DIRECTOR TAMPOCO INSCRIBE A OTRO, y es a propósito: la inscripción es una
-- declaración de la persona sobre sí misma. Si el coro pide inscribir a quien
-- no tiene teléfono, es otra decisión y otra política — queda declarado en §17.
drop policy if exists misa_participante_write on public.misa_participante;
create policy misa_participante_write on public.misa_participante
  for all
  using      (perfil_id = auth.uid() and public.puede_ver_coro(coro_id))
  with check (perfil_id = auth.uid() and public.puede_ver_coro(coro_id));
