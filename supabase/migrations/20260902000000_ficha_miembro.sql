-- =============================================================================
-- H14 · Ficha del miembro — docs/PRD.md §17, y B5 del backlog de §19
--
-- Clase C (§7): tabla sensible con predicado propio. La escribe SOLO su dueño;
-- la lee su dueño y el director del coro.
--
-- POR QUÉ UNA TABLA Y NO CUATRO COLUMNAS EN `coro_acceso`, COMO DECÍA B5:
--   B5 se escribió cuando la ficha la cargaba el director. El 2026-09-02 el
--   dueño decidió que la carga cada uno. Eso lo cambia todo: `coro_acceso`
--   tiene `rol_local`, y una política que deja al músico escribir su fila para
--   poner su tesitura es la misma puerta por la que después se escribe
--   `rol_local = 'director'`. Es el razonamiento textual de H11 con `perfiles`,
--   aplicado a la tabla de gobierno del coro.
--
--   Separando la ficha, `coro_acceso_write` sigue siendo `es_director_de()` y
--   no se toca una sola política de §8.
--
-- POR QUÉ EL SEXO NO ESTÁ:
--   §19.2-B5 ya lo anotaba: la tesitura dice qué voz canta una persona con más
--   precisión que el sexo —hay mujeres contralto y hombres tenor—. Se guarda
--   el dato que se usa para armar voces, no el que se usaría para adivinarlo.
--
-- POR QUÉ `fecha_nacimiento` Y NO `edad`:
--   La edad es un derivado: se calcula al leer con `edadEn()`, contra el día
--   del coro. Una edad guardada envejece mal y contradice el innegociable de
--   cero derivados persistidos.
-- =============================================================================

create table if not exists public.ficha_miembro (
  perfil_id        uuid not null references public.perfiles(id) on delete cascade,
  coro_id          uuid not null references public.coros(id)    on delete cascade,

  -- Los tres campos son opcionales: una ficha a medias es más útil que ninguna,
  -- y obligar a declarar la fecha de nacimiento para elegir tesitura dejaría a
  -- la mitad del coro sin cargar nada.
  fecha_nacimiento date,
  tesitura         text check (tesitura in
                     ('soprano', 'mezzosoprano', 'contralto', 'tenor', 'baritono', 'bajo')),
  -- Tres niveles nombrados y no un 1-5: un número invita a una precisión que
  -- nadie tiene sobre su propia disponibilidad.
  disponibilidad   text check (disponibilidad in
                     ('rara_vez', 'a_veces', 'casi_siempre')),

  updated_at       timestamptz not null default now(),

  -- Una ficha por persona EN CADA CORO: la tesitura es de la persona, pero la
  -- disponibilidad depende del coro al que va, y §7 ya trata la pertenencia
  -- como par (perfil, coro).
  primary key (perfil_id, coro_id)
);

comment on table public.ficha_miembro is
  'H14. Datos de una persona dentro de un coro: nacimiento, tesitura y disponibilidad. Los escribe su dueño; los lee su dueño y el director del coro. El sexo NO se guarda (PRD §19.2-B5) y la edad tampoco: se calcula.';

comment on column public.ficha_miembro.fecha_nacimiento is
  'La edad se calcula al leer con edadEn(). Guardarla sería un derivado persistido.';

-- El director lista la ficha de todo su coro: se busca por coro_id, que no es
-- la primera columna de la clave primaria.
create index if not exists ficha_miembro_coro_idx on public.ficha_miembro (coro_id);

-- -----------------------------------------------------------------------------
-- RLS — activa en la MISMA migración que crea la tabla.
-- -----------------------------------------------------------------------------

alter table public.ficha_miembro enable row level security;

-- Ver: la propia, o —si sos director de ese coro— la de tus miembros.
--
-- A diferencia de `preferencias_perfil` (H11), acá el director SÍ ve: la ficha
-- existe para que pueda armar voces y saber con quién cuenta. El admin NO está
-- incluido: no dirige coros, y §8.2 no le da un motivo para leer la edad de
-- nadie.
drop policy if exists ficha_miembro_select on public.ficha_miembro;
create policy ficha_miembro_select on public.ficha_miembro
  for select using (
    perfil_id = auth.uid()
    or public.es_director_de(coro_id)
  );

-- Escribir: SOLO la propia, y solo en un coro al que ya pertenecés.
--
-- El segundo predicado no es teatro: sin él, cualquiera podría sembrar fichas
-- suyas en coros donde no entró, y el director de ese coro las leería.
-- `puede_ver_coro` ya exige pertenencia aprobada, que es el portón de §8.4.
--
-- El director NO escribe la ficha de otro: si un dato está mal, lo corrige su
-- dueño. Abrirlo convertiría esta tabla en un segundo lugar donde se decide
-- sobre una persona sin que ella lo sepa.
drop policy if exists ficha_miembro_write on public.ficha_miembro;
create policy ficha_miembro_write on public.ficha_miembro
  for all
  using (perfil_id = auth.uid() and public.puede_ver_coro(coro_id))
  with check (perfil_id = auth.uid() and public.puede_ver_coro(coro_id));
