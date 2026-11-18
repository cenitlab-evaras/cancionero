-- «Salida» como segmento propio (2026-11-18).
--
-- El catálogo venía con los 11 momentos del Misal que el coro usa al armar la
-- misa; el dueño pidió el segmento de salida para poder llenarlo como los
-- demás. Va al final del orden litúrgico (12).
--
-- Idempotente: si la fila ya existe, no hace nada.

insert into public.momentos_liturgicos (codigo, nombre, orden)
select 'salida', 'Salida', 12
where not exists (select 1 from public.momentos_liturgicos where codigo = 'salida');

comment on column public.momentos_liturgicos.orden is
  'Orden litúrgico: Entrada 1 … Himnos 11, Salida 12. Lo usa el repertorio, la misa y el armador.';
