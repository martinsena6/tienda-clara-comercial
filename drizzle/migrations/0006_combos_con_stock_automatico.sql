create table public.combo_items (
  combo_id uuid not null references public.products(id) on delete cascade,
  component_id uuid not null references public.products(id) on delete restrict,
  quantity int not null check (quantity > 0),
  primary key (combo_id, component_id), check (combo_id <> component_id));
alter table public.combo_items enable row level security;
create policy "Admin gestiona recetas de combos" on public.combo_items for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.product_effective_stock(p_id uuid)
returns int language sql stable security definer set search_path to 'public' as $f$
  select case when exists (select 1 from public.combo_items where combo_id = p_id)
    then coalesce((select min(floor(greatest(c.stock, 0)::numeric / ci.quantity))::int from public.combo_items ci join public.products c on c.id = ci.component_id where ci.combo_id = p_id), 0)
    else (select stock from public.products where id = p_id) end
$f$;

create or replace function public.product_effective_cost(p_id uuid)
returns numeric language sql stable security definer set search_path to 'public' as $f$
  select case when exists (select 1 from public.combo_items where combo_id = p_id)
    then coalesce((select sum(c.cost * ci.quantity) from public.combo_items ci join public.products c on c.id = ci.component_id where ci.combo_id = p_id), 0)
    else coalesce((select cost from public.products where id = p_id), 0) end
$f$;

create or replace function public.consume_product_stock(p_product_id uuid, p_qty int, p_reason text, p_user uuid)
returns void language plpgsql security definer set search_path to 'public' as $f$
declare ci record; v_delta int;
begin
  if exists (select 1 from public.combo_items where combo_id = p_product_id) then
    for ci in select component_id, quantity from public.combo_items where combo_id = p_product_id loop
      v_delta := -(p_qty * ci.quantity);
      insert into public.stock_movements (product_id, type, quantity, reason, user_id)
        values (ci.component_id, case when v_delta < 0 then 'salida'::public.stock_movement_type else 'entrada'::public.stock_movement_type end, v_delta, p_reason, p_user);
      update public.products set stock = stock + v_delta where id = ci.component_id;
    end loop;
  elsif exists (select 1 from public.products where id = p_product_id) then
    v_delta := -p_qty;
    insert into public.stock_movements (product_id, type, quantity, reason, user_id)
      values (p_product_id, case when v_delta < 0 then 'salida'::public.stock_movement_type else 'entrada'::public.stock_movement_type end, v_delta, p_reason, p_user);
    update public.products set stock = stock + v_delta where id = p_product_id;
  end if;
end $f$;

create or replace function public.copy_combo_recipe(p_from uuid, p_to uuid, p_factor numeric default 1)
returns int language plpgsql security definer set search_path to 'public' as $f$
declare v_n int;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Sin permiso'; end if;
  if p_from = p_to or p_factor <= 0 then raise exception 'Datos inválidos'; end if;
  delete from public.combo_items where combo_id = p_to;
  insert into public.combo_items (combo_id, component_id, quantity)
    select p_to, component_id, greatest(1, round(quantity * p_factor)::int) from public.combo_items where combo_id = p_from;
  get diagnostics v_n = row_count;
  return v_n;
end $f$;

create or replace function public.confirm_order(p_order_id uuid, p_allow_negative boolean default true)
returns void language plpgsql security definer set search_path to 'public' as $f$
declare o record; it jsonb; v_cost numeric; v_stock int; v_name text; v_qty int; v_pid uuid; v_total_cost numeric := 0; v_items jsonb := '[]'::jsonb;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Sin permiso'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then raise exception 'Pedido no encontrado'; end if;
  if o.status <> 'pendiente' then raise exception 'El pedido ya no está pendiente'; end if;
  if not p_allow_negative then
    for it in select * from jsonb_array_elements(o.items) loop
      v_pid := (it->>'product_id')::uuid; v_qty := (it->>'quantity')::int;
      select name into v_name from public.products where id = v_pid;
      v_stock := public.product_effective_stock(v_pid);
      if v_stock is not null and v_stock < v_qty then raise exception 'Stock insuficiente: % (hay %, pedido %)', v_name, v_stock, v_qty; end if;
    end loop;
  end if;
  for it in select * from jsonb_array_elements(o.items) loop
    v_pid := (it->>'product_id')::uuid; v_qty := (it->>'quantity')::int;
    v_cost := public.product_effective_cost(v_pid);
    v_total_cost := v_total_cost + v_cost * v_qty;
    v_items := v_items || jsonb_build_array(it || jsonb_build_object('unit_cost', v_cost));
    perform public.consume_product_stock(v_pid, v_qty, 'Venta confirmada #' || o.number, auth.uid());
  end loop;
  update public.orders set status = 'confirmado', confirmed_at = now(), items = v_items, cost_total = v_total_cost where id = p_order_id;
end $f$;

create or replace function public.create_counter_sale(p_items jsonb, p_note text default '', p_allow_negative boolean default true)
returns table(order_number int, order_total numeric)
language plpgsql security definer set search_path to 'public' as $f$
declare v_items jsonb := '[]'; v_total numeric := 0; v_cost numeric := 0; it record; p record; v_num int; v_price numeric; v_uc numeric; v_stock int;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Sin permiso'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 60 then raise exception 'Venta sin productos'; end if;
  v_num := nextval('public.orders_number_seq');
  for it in select (i->>'product_id')::uuid as pid, (i->>'quantity')::int as qty, nullif(i->>'unit_price', '')::numeric as up from jsonb_array_elements(p_items) i loop
    if it.qty is null or it.qty < 1 or it.qty > 999 then raise exception 'Cantidad inválida'; end if;
    select id, name, price into p from public.products where id = it.pid;
    if p.id is null then raise exception 'Producto inexistente'; end if;
    v_stock := public.product_effective_stock(it.pid);
    if not p_allow_negative and v_stock < it.qty then raise exception 'Stock insuficiente: % (hay %, pedido %)', p.name, v_stock, it.qty; end if;
    v_price := coalesce(it.up, p.price);
    if v_price < 0 then raise exception 'Precio inválido'; end if;
    v_uc := public.product_effective_cost(it.pid);
    v_items := v_items || jsonb_build_object('product_id', p.id, 'name', p.name, 'quantity', it.qty, 'unit_price', v_price, 'unit_cost', v_uc);
    v_total := v_total + it.qty * v_price; v_cost := v_cost + it.qty * v_uc;
    perform public.consume_product_stock(it.pid, it.qty, 'Venta mostrador #' || v_num, auth.uid());
  end loop;
  insert into public.orders (number, customer_name, items, total, status, channel, confirmed_at, cost_total, notes)
    values (v_num, 'Venta mostrador', v_items, v_total, 'confirmado', 'local', now(), v_cost, left(coalesce(p_note, ''), 300));
  return query select v_num, v_total;
end $f$;

create or replace function public.void_confirmed_order(p_order_id uuid, p_reason text default '')
returns void language plpgsql security definer set search_path to 'public' as $f$
declare o record; it jsonb;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Sin permiso'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then raise exception 'Pedido no encontrado'; end if;
  if o.status <> 'confirmado' then raise exception 'Solo se pueden anular ventas confirmadas'; end if;
  for it in select * from jsonb_array_elements(o.items) loop
    perform public.consume_product_stock((it->>'product_id')::uuid, -((it->>'quantity')::int), 'Anulación venta #' || o.number, auth.uid());
  end loop;
  update public.orders set status = 'cancelado', notes = btrim(notes || ' | Anulada: ' || left(coalesce(p_reason, ''), 150)) where id = p_order_id;
end $f$;

drop function if exists public.get_public_products();
create function public.get_public_products()
returns table(slug text, name text, category_slug text, category_name text, description text, image_url text, price numeric, availability text, image_urls jsonb, featured boolean, badge text)
language sql stable security definer set search_path to 'public' as $f$
  select p.slug, p.name, coalesce(c.slug, ''), coalesce(c.name, 'Sin categoría'), p.description, p.image_url, p.price,
    case when public.product_effective_stock(p.id) <= 0 then 'sin_stock' when public.product_effective_stock(p.id) <= p.min_stock then 'pocas_unidades' else 'disponible' end,
    p.image_urls, p.featured, p.badge
  from public.products p left join public.categories c on c.id = p.category_id
  where p.active order by c.sort, p.name
$f$;

create or replace view public.products_staff as
  select id, slug, name, category_id, description, image_url, price, stock, min_stock, active, created_at, updated_at, image_urls, featured, badge,
         public.product_effective_stock(id) as stock_disponible
  from public.products where public.is_staff(auth.uid());
revoke all on public.products_staff from public, anon;
grant select on public.products_staff to authenticated;

do $$ declare v_row record; begin
  for v_row in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('product_effective_stock', 'product_effective_cost', 'consume_product_stock', 'copy_combo_recipe', 'confirm_order', 'create_counter_sale', 'void_confirmed_order', 'get_public_products') loop
    execute format('revoke execute on function %s from public, anon', v_row.sig);
    execute format('grant execute on function %s to authenticated', v_row.sig);
    if v_row.proname = 'get_public_products' then execute format('grant execute on function %s to anon', v_row.sig); end if;
  end loop;
end $$;
