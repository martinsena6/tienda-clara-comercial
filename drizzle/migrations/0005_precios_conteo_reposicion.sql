alter table public.price_history add column if not exists batch_id uuid, add column if not exists reason text not null default '';

create or replace function public.log_price_change() returns trigger language plpgsql security definer set search_path to 'public' as $f$
begin
  if new.price is distinct from old.price or new.cost is distinct from old.cost then
    insert into public.price_history (product_id, old_price, new_price, old_cost, new_cost, changed_by, batch_id, reason)
    values (new.id, old.price, new.price, old.cost, new.cost, auth.uid(), nullif(current_setting('app.batch_id', true), '')::uuid, coalesce(current_setting('app.reason', true), ''));
  end if;
  return new;
end $f$;

create or replace function public.round_price(p_value numeric, p_step numeric default 50)
returns numeric language sql immutable as $f$
  select case when p_step is null or p_step <= 0 then round(p_value, 2) else round(p_value / p_step) * p_step end
$f$;

create or replace function public.apply_price_changes(p_changes jsonb, p_reason text default '')
returns uuid language plpgsql security definer set search_path to 'public' as $f$
declare v_batch uuid := gen_random_uuid(); it record;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Sin permiso'; end if;
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) not between 1 and 500 then raise exception 'Datos inválidos'; end if;
  perform set_config('app.batch_id', v_batch::text, true);
  perform set_config('app.reason', left(coalesce(p_reason, ''), 200), true);
  for it in select (c->>'product_id')::uuid as pid, (c->>'new_price')::numeric as np from jsonb_array_elements(p_changes) c loop
    if it.np is null or it.np < 0 then raise exception 'Precio inválido'; end if;
    update public.products set price = it.np where id = it.pid and price <> it.np;
  end loop;
  perform set_config('app.batch_id', '', true);
  perform set_config('app.reason', '', true);
  return v_batch;
end $f$;

create or replace function public.undo_price_batch(p_batch uuid)
returns int language plpgsql security definer set search_path to 'public' as $f$
declare v_new uuid := gen_random_uuid(); it record; v_n int := 0;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Sin permiso'; end if;
  perform set_config('app.batch_id', v_new::text, true);
  perform set_config('app.reason', 'Deshacer lote ' || left(p_batch::text, 8), true);
  for it in select product_id, old_price, new_price from public.price_history where batch_id = p_batch and old_price is distinct from new_price order by changed_at desc loop
    update public.products set price = it.old_price where id = it.product_id and price = it.new_price;
    if found then v_n := v_n + 1; end if;
  end loop;
  perform set_config('app.batch_id', '', true);
  perform set_config('app.reason', '', true);
  return v_n;
end $f$;

create or replace function public.apply_stock_count(p_counts jsonb, p_reason text default 'Conteo físico')
returns int language plpgsql security definer set search_path to 'public' as $f$
declare it record; v_stock int; v_n int := 0;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Sin permiso'; end if;
  if jsonb_typeof(p_counts) <> 'array' then raise exception 'Datos inválidos'; end if;
  for it in select (c->>'product_id')::uuid as pid, (c->>'counted')::int as counted from jsonb_array_elements(p_counts) c loop
    if it.counted is null or it.counted < 0 then raise exception 'Cantidad inválida'; end if;
    select stock into v_stock from public.products where id = it.pid for update;
    if v_stock is not null and v_stock <> it.counted then
      insert into public.stock_movements (product_id, type, quantity, reason, user_id) values (it.pid, 'ajuste', it.counted - v_stock, left(coalesce(p_reason, 'Conteo físico'), 200), auth.uid());
      update public.products set stock = it.counted where id = it.pid;
      v_n := v_n + 1;
    end if;
  end loop;
  return v_n;
end $f$;

create or replace function public.replenishment_suggestions(p_days int default 30, p_cover_days int default 21)
returns table(product_id uuid, name text, category text, supplier text, stock int, min_stock int, cost numeric, unidades_vendidas int, venta_diaria numeric, dias_cobertura numeric, sugerido int)
language plpgsql stable security definer set search_path to 'public' as $f$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Sin permiso'; end if;
  return query
  with sold as (
    select (e->>'product_id')::uuid as pid, sum((e->>'quantity')::int)::int as u
    from public.orders o, jsonb_array_elements(o.items) e
    where o.status = 'confirmado' and o.confirmed_at >= now() - make_interval(days => p_days) group by 1)
  select p.id, p.name, coalesce(c.name, ''), p.supplier, p.stock, p.min_stock, p.cost, coalesce(s.u, 0),
    round(coalesce(s.u, 0)::numeric / p_days, 3),
    case when coalesce(s.u, 0) = 0 then null else round(p.stock / (s.u::numeric / p_days), 1) end,
    greatest(0, ceil(coalesce(s.u, 0)::numeric / p_days * p_cover_days)::int + p.min_stock - p.stock)
  from public.products p left join public.categories c on c.id = p.category_id left join sold s on s.pid = p.id
  where p.active and (c.name is null or c.name not ilike 'combo%')
  order by 11 desc, 10 asc nulls last;
end $f$;

do $$ declare v_row record; begin
  for v_row in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('apply_price_changes', 'undo_price_batch', 'apply_stock_count', 'replenishment_suggestions') loop
    execute format('revoke execute on function %s from public, anon', v_row.sig);
    execute format('grant execute on function %s to authenticated', v_row.sig);
  end loop;
end $$;
