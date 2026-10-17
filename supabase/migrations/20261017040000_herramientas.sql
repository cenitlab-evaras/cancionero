-- =============================================================================
-- «Herramientas» (pedido del dueño, 2026-10-17): interruptores que cada persona
-- prende para sí — quién canta cada estrofa, resaltar su cuerda, dar el tono,
-- acordes en Do-Re-Mi. Ver lib/motores/herramientas.ts.
--
-- Van en `preferencias_perfil`, la tabla de lo que vale para la persona en todo
-- el repertorio (H11 y el tamaño de letra): hereda su política de clase C, ya
-- verificada — cada uno ve y escribe solo la suya. El `check` es la misma lista
-- que el motor: un id que la app no conoce no entra.
-- =============================================================================

alter table public.preferencias_perfil
  add column if not exists herramientas text[] not null default '{}'
    check (herramientas <@ array['quien_canta', 'mi_cuerda', 'dar_tono', 'notacion_latina']::text[]);

comment on column public.preferencias_perfil.herramientas is
  'Las herramientas que la persona tiene prendidas (ids de lib/motores/herramientas.ts).';
