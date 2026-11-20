-- Archivar misas viejas (el dueño, 2026-11-20): la fila queda en la base como
-- respaldo, pero la misa deja de aparecer en la app. El historial de lo que se
-- cantó NO se toca: las ejecuciones siguen contando.
alter table public.misas
  add column if not exists archivada boolean not null default false;

comment on column public.misas.archivada is
  'true = fuera de la app, como respaldo. No borra la misa ni su historial de cantos.';

create index if not exists misas_coro_archivada_idx
  on public.misas (coro_id, archivada);
