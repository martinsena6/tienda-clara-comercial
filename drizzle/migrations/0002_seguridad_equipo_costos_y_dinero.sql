drop policy if exists "Personal ve productos" on public.products;
create policy "Admin ve productos" on public.products for select to authenticated using (public.has_role(auth.uid(), 'admin'));
drop policy if exists "Personal ve pedidos" on public.orders;
create policy "Admin ve pedidos" on public.orders for select to authenticated using (public.has_role(auth.uid(), 'admin'));

create or replace view public.products_staff as
  select id, slug, name, category_id, description, image_url, price, stock, min_stock, active, created_at, updated_at
  from public.products where public.is_staff(auth.uid());
create or replace view public.orders_staff as
  select id, number, customer_name, customer_phone,
         (select coalesce(jsonb_agg(e - 'unit_cost' order by n), '[]'::jsonb) from jsonb_array_elements(items) with ordinality as t(e, n)) as items,
         total, status, channel, created_at, confirmed_at
  from public.orders where public.is_staff(auth.uid());
revoke all on public.products_staff, public.orders_staff from public, anon;
grant select on public.products_staff, public.orders_staff to authenticated;
revoke execute on function public.touch_updated_at() from public, anon;

create or replace function public.list_team()
returns table(user_id uuid, email text, role public.app_role, created_at timestamptz)
language plpgsql stable security definer set search_path to 'public' as $f$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Sin permiso'; end if;
  return query select u.id, u.email::text, r.role, u.created_at from auth.users u left join public.user_roles r on r.user_id = u.id order by u.created_at;
end $f$;

create or replace function public.set_user_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path to 'public' as $f$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Sin permiso'; end if;
  if p_user_id = auth.uid() then raise exception 'No podés cambiar tu propio rol'; end if;
  if p_role not in ('admin', 'vendedor', 'ninguno') then raise exception 'Rol inválido'; end if;
  delete from public.user_roles where user_id = p_user_id;
  if p_role <> 'ninguno' then insert into public.user_roles (user_id, role) values (p_user_id, p_role::public.app_role); end if;
end $f$;

create table public.suppliers (
  id uuid primary key default gen_random_uuid(), name text not null unique, phone text not null default '', notes text not null default '', created_at timestamptz not null default now());
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null default ((now() at time zone 'America/Argentina/Buenos_Aires')::date),
  category text not null, description text not null default '', amount numeric(12,2) not null check (amount >= 0),
  created_by uuid default auth.uid(), created_at timestamptz not null default now());
create table public.purchases (
  id uuid primary key default gen_random_uuid(), number int generated always as identity,
  date date not null default ((now() at time zone 'America/Argentina/Buenos_Aires')::date),
  supplier_id uuid references public.suppliers(id) on delete set null, total numeric(12,2) not null default 0,
  notes text not null default '', created_by uuid, created_at timestamptz not null default now());
create table public.purchase_items (
  id uuid primary key default gen_random_uuid(), purchase_id uuid not null references public.purchases(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity int not null check (quantity > 0), unit_cost numeric(12,2) not null check (unit_cost >= 0));
create index expenses_date_idx on public.expenses (date desc);
create index purchases_date_idx on public.purchases (date desc);
create index purchase_items_purchase_idx on public.purchase_items (purchase_id);
alter table public.suppliers enable row level security;
alter table public.expenses enable row level security;
alter table public.purchases enable row level security;
alter table public.purchase_items enable row level security;
create policy "Admin gestiona proveedores" on public.suppliers for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admin gestiona gastos" on public.expenses for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admin gestiona compras" on public.purchases for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admin gestiona items de compras" on public.purchase_items for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.register_purchase(p_date date, p_supplier_id uuid, p_notes text, p_items jsonb, p_update_cost boolean default true)
returns table(purchase_number int, total numeric) language plpgsql security definer set search_path to 'public' as $f$
declare v_id uuid; v_num int; v_total numeric := 0; it record;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Sin permiso'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 200 then raise exception 'La compra no tiene productos'; end if;
  insert into public.purchases (date, supplier_id, notes, created_by)
    values (coalesce(p_date, (now() at time zone 'America/Argentina/Buenos_Aires')::date), p_supplier_id, left(coalesce(p_notes, ''), 300), auth.uid())
    returning id, number into v_id, v_num;
  for it in select (i->>'product_id')::uuid as pid, (i->>'quantity')::int as qty, (i->>'unit_cost')::numeric as uc from jsonb_array_elements(p_items) i loop
    if it.qty is null or it.qty <= 0 or it.uc is null or it.uc < 0 then raise exception 'Cantidad o costo inválido'; end if;
    if not exists (select 1 from public.products where id = it.pid) then raise exception 'Producto inexistente'; end if;
    insert into public.purchase_items (purchase_id, product_id, quantity, unit_cost) values (v_id, it.pid, it.qty, it.uc);
    insert into public.stock_movements (product_id, type, quantity, reason, user_id) values (it.pid, 'entrada', it.qty, 'Compra #' || v_num, auth.uid());
    update public.products set stock = stock + it.qty, cost = case when p_update_cost and it.uc > 0 then it.uc else cost end where id = it.pid;
    v_total := v_total + it.qty * it.uc;
  end loop;
  update public.purchases set total = v_total where id = v_id;
  return query select v_num, v_total;
end $f$;

create or replace function public.apply_costs(p_rows jsonb)
returns int language plpgsql security definer set search_path to 'public' as $f$
declare it record; v_n int := 0;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Sin permiso'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'Datos inválidos'; end if;
  for it in select (i->>'product_id')::uuid as pid, nullif(i->>'cost', '')::numeric as cost, nullif(btrim(i->>'supplier'), '') as supplier from jsonb_array_elements(p_rows) i loop
    if it.cost is not null and it.cost < 0 then raise exception 'Costo negativo'; end if;
    update public.products set cost = coalesce(it.cost, cost), supplier = coalesce(left(it.supplier, 120), supplier) where id = it.pid;
    if found then v_n := v_n + 1; end if;
  end loop;
  return v_n;
end $f$;

create or replace function public.business_report(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $f$
declare tz constant text := 'America/Argentina/Buenos_Aires'; v_d1 date; v_d2 date; r jsonb;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Sin permiso'; end if;
  v_d1 := (p_from at time zone tz)::date; v_d2 := (p_to at time zone tz)::date;
  with o as (select * from public.orders where status = 'confirmado' and confirmed_at >= p_from and confirmed_at < p_to),
  li as (select (e->>'product_id')::uuid as pid, e->>'name' as name, (e->>'quantity')::int as qty, (e->>'unit_price')::numeric as up, coalesce((e->>'unit_cost')::numeric, 0) as uc from o, jsonb_array_elements(o.items) e)
  select jsonb_build_object(
    'ventas', coalesce((select sum(total) from o), 0),
    'pedidos', (select count(*) from o),
    'ticket_promedio', coalesce((select round(avg(total), 2) from o), 0),
    'costo_mercaderia', coalesce((select sum(cost_total) from o), 0),
    'pedidos_sin_costo', (select count(*) from o where cost_total <= 0),
    'gastos', coalesce((select sum(amount) from public.expenses where date >= v_d1 and date < v_d2), 0),
    'gastos_por_categoria', coalesce((select jsonb_agg(t order by t.total desc) from (select category, sum(amount) as total from public.expenses where date >= v_d1 and date < v_d2 group by category) t), '[]'::jsonb),
    'pendientes', (select count(*) from public.orders where status = 'pendiente'),
    'top_unidades', coalesce((select jsonb_agg(t) from (select name, sum(qty)::int as unidades, sum(qty * up) as ventas, sum(qty * (up - uc)) as ganancia from li group by pid, name order by sum(qty) desc limit 10) t), '[]'::jsonb),
    'top_ganancia', coalesce((select jsonb_agg(t) from (select name, sum(qty)::int as unidades, sum(qty * up) as ventas, sum(qty * (up - uc)) as ganancia from li group by pid, name order by sum(qty * (up - uc)) desc limit 10) t), '[]'::jsonb),
    'por_dia', coalesce((select jsonb_agg(t order by t.dia) from (select (confirmed_at at time zone tz)::date as dia, count(*)::int as pedidos, sum(total) as ventas from o group by 1) t), '[]'::jsonb),
    'inventario_costo', (select coalesce(sum(stock * cost), 0) from public.products where stock > 0),
    'inventario_precio', (select coalesce(sum(stock * price), 0) from public.products where stock > 0),
    'productos_sin_costo', (select count(*) from public.products where active and cost <= 0),
    'sin_movimiento_60d', (select count(*) from public.products p where p.active and p.stock > 0 and not exists (select 1 from public.stock_movements m where m.product_id = p.id and m.type = 'salida' and m.created_at > now() - interval '60 days'))
  ) into r;
  return r;
end $f$;

do $$ declare v_row record; begin
  for v_row in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('list_team', 'set_user_role', 'register_purchase', 'apply_costs', 'business_report') loop
    execute format('revoke execute on function %s from public, anon', v_row.sig);
    execute format('grant execute on function %s to authenticated', v_row.sig);
  end loop;
end $$;