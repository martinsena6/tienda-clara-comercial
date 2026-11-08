alter table public.products alter column min_stock set default 7;
update public.products set min_stock = 7 where min_stock is distinct from 7;
