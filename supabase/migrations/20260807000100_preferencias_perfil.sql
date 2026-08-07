-- =============================================================================
-- H11 · Modo solo letra — docs/PRD.md §17, y B3 del backlog de §19
--
-- Clase C (§7): tabla sensible con predicado propio, más estrecho que el
-- alcance del coro. Cada uno ve SOLO la suya — tampoco el director, tampoco el
-- admin, igual que `preferencias_lectura` desde H3.
--
-- POR QUÉ UNA TABLA Y NO UNA COLUMNA EN `perfiles`:
--   `perfiles_write` es `es_admin()` entero. Guardar acá una preferencia de
--   lectura obligaría a abrir esa política a "cada uno escribe su fila", y esa
--   misma fila tiene `rol` y `aprobado` — el portón de §8. Una política que
--   deja a alguien escribir su propio perfil para apagar unos acordes es la
--   puerta por la que después se escribe `aprobado = true`.
--
--   Separar la preferencia en su propia tabla mantiene `perfiles` cerrado y
--   copia una política ya verificada, en vez de inventar una.
--
-- POR QUÉ NO ES UNA COLUMNA EN `preferencias_lectura`:
--   Esa tabla es por canto (`unique (perfil_id, canto_id)`). El "Abierto" de
--   B3 dice que quien solo canta los quiere apagados y punto: la preferencia
--   es de la PERSONA. Meterla ahí obligaría a escribirla en cada canto y a
--   decidir qué pasa con los cantos que la persona nunca abrió.
-- =============================================================================

create table if not exists cantoral.preferencias_perfil (
  perfil_id       uuid primary key references cantoral.perfiles(id) on delete cascade,
  -- El default es `true`: el producto es un cancionero con acordes y esa es la
  -- lectura normal. Quien no los quiere, los apaga una vez.
  mostrar_acordes boolean not null default true,
  updated_at      timestamptz not null default now()
);

comment on table cantoral.preferencias_perfil is
  'Preferencias de lectura de una persona, válidas en TODO el repertorio. Las que son por canto —transposición y tamaño de letra— viven en preferencias_lectura (PRD §7).';

comment on column cantoral.preferencias_perfil.mostrar_acordes is
  'H11. En false la lectura omite los acordes EN EL MOTOR, no con CSS: no quedan en el HTML.';

-- `perfil_id` es la clave primaria, así que no hace falta índice aparte: una
-- persona tiene una fila y se busca siempre por ella.

-- -----------------------------------------------------------------------------
-- RLS — clase C, predicado propio. Activa en la MISMA migración que la crea.
-- -----------------------------------------------------------------------------

alter table cantoral.preferencias_perfil enable row level security;

-- Ver: solo la propia. Sin excepción para admin ni director (§8.2, la fila
-- `ver_preferencia_ajena` dice que no para los tres roles).
drop policy if exists preferencias_perfil_select on cantoral.preferencias_perfil;
create policy preferencias_perfil_select on cantoral.preferencias_perfil
  for select using (perfil_id = auth.uid());

-- Escribir: solo la propia.
--
-- A diferencia de `preferencias_lectura`, acá NO hay un segundo predicado de
-- coro: esta preferencia no cuelga de ningún canto ni de ningún coro, así que
-- no hay alcance que comprobar. Agregar un `puede_ver_coro` sería teatro.
drop policy if exists preferencias_perfil_write on cantoral.preferencias_perfil;
create policy preferencias_perfil_write on cantoral.preferencias_perfil
  for all using (perfil_id = auth.uid())
          with check (perfil_id = auth.uid());
