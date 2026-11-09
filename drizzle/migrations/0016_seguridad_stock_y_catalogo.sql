create or replace function public.lock_and_check_product_stock(p_items jsonb)
returns void
language plpgsql
set search_path to 'public'
as $f$
declare
  it record;
begin
  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Datos de productos inválidos';
  end if;

  perform 1
  from public.combo_items ci
  where ci.combo_id in (
    select (item->>'product_id')::uuid
    from jsonb_array_elements(p_items) item
  )
  order by ci.combo_id, ci.component_id
  for share;

  perform 1
  from public.products p
  where p.id in (
    select coalesce(ci.component_id, requested.product_id)
    from (
      select (item->>'product_id')::uuid as product_id
      from jsonb_array_elements(p_items) item
    ) requested
    left join public.combo_items ci on ci.combo_id = requested.product_id
  )
  order by p.id
  for update;

  for it in
    with requested as (
      select
        (item->>'product_id')::uuid as product_id,
        (item->>'quantity')::int as quantity
      from jsonb_array_elements(p_items) item
    ),
    required_stock as (
      select
        coalesce(ci.component_id, requested.product_id) as product_id,
        sum(requested.quantity * coalesce(ci.quantity, 1))::int as quantity
      from requested
      left join public.combo_items ci on ci.combo_id = requested.product_id
      group by 1
    )
    select p.name, p.stock, required_stock.quantity
    from required_stock
    join public.products p on p.id = required_stock.product_id
    order by p.id
  loop
    if it.stock < it.quantity then
      raise exception 'Stock insuficiente: % (hay %, pedido %)', it.name, it.stock, it.quantity;
    end if;
  end loop;
end
$f$;

create or replace function public.confirm_order(
  p_order_id uuid,
  p_allow_negative boolean default true
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $f$
declare
  o record;
  it jsonb;
  v_cost numeric;
  v_qty int;
  v_pid uuid;
  v_total_cost numeric := 0;
  v_items jsonb := '[]'::jsonb;
begin
  if not public.is_staff(auth.uid()) then
    raise exception 'Sin permiso';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then raise exception 'Pedido no encontrado'; end if;
  if o.status <> 'pendiente' then raise exception 'El pedido ya no está pendiente'; end if;

  if not coalesce(p_allow_negative, false) then
    perform public.lock_and_check_product_stock(o.items);
  end if;

  for it in select * from jsonb_array_elements(o.items) loop
    v_pid := (it->>'product_id')::uuid;
    v_qty := (it->>'quantity')::int;
    v_cost := public.product_effective_cost(v_pid);
    v_total_cost := v_total_cost + v_cost * v_qty;
    v_items := v_items || jsonb_build_array(it || jsonb_build_object('unit_cost', v_cost));
    perform public.consume_product_stock(v_pid, v_qty, 'Venta confirmada #' || o.number, auth.uid());
  end loop;

  update public.orders
  set status = 'confirmado',
      confirmed_at = now(),
      items = v_items,
      cost_total = v_total_cost
  where id = p_order_id;
end
$f$;

create or replace function public.create_counter_sale(
  p_items jsonb,
  p_note text default '',
  p_allow_negative boolean default true
)
returns table(order_number int, order_total numeric)
language plpgsql
security definer
set search_path to 'public'
as $f$
declare
  v_items jsonb := '[]'::jsonb;
  v_total numeric := 0;
  v_cost numeric := 0;
  it record;
  p record;
  v_num int;
  v_price numeric;
  v_uc numeric;
  v_stock int;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Sin permiso'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 60 then
    raise exception 'Venta sin productos';
  end if;

  if not coalesce(p_allow_negative, false) then
    perform public.lock_and_check_product_stock(p_items);
  end if;

  v_num := nextval('public.orders_number_seq');
  for it in
    select
      (i->>'product_id')::uuid as pid,
      (i->>'quantity')::int as qty,
      nullif(i->>'unit_price', '')::numeric as up
    from jsonb_array_elements(p_items) i
  loop
    if it.qty is null or it.qty < 1 or it.qty > 999 then raise exception 'Cantidad inválida'; end if;
    select id, name, price into p from public.products where id = it.pid;
    if p.id is null then raise exception 'Producto inexistente'; end if;

    v_stock := public.product_effective_stock(it.pid);
    if not coalesce(p_allow_negative, false) and v_stock < it.qty then
      raise exception 'Stock insuficiente: % (hay %, pedido %)', p.name, v_stock, it.qty;
    end if;

    v_price := coalesce(it.up, p.price);
    if v_price < 0 then raise exception 'Precio inválido'; end if;
    v_uc := public.product_effective_cost(it.pid);
    v_items := v_items || jsonb_build_object(
      'product_id', p.id,
      'name', p.name,
      'quantity', it.qty,
      'unit_price', v_price,
      'unit_cost', v_uc
    );
    v_total := v_total + it.qty * v_price;
    v_cost := v_cost + it.qty * v_uc;
    perform public.consume_product_stock(it.pid, it.qty, 'Venta mostrador #' || v_num, auth.uid());
  end loop;

  insert into public.orders (
    number, customer_name, items, total, status, channel, confirmed_at, cost_total, notes
  )
  values (
    v_num, 'Venta mostrador', v_items, v_total, 'confirmado', 'local', now(), v_cost,
    left(coalesce(p_note, ''), 300)
  );
  return query select v_num, v_total;
end
$f$;

create or replace function public.get_public_products()
returns table(
  slug text,
  name text,
  category_slug text,
  category_name text,
  description text,
  image_url text,
  price numeric,
  availability text,
  image_urls jsonb,
  featured boolean,
  badge text
)
language sql
stable
security definer
set search_path to 'public'
as $f$
  select
    p.slug,
    p.name,
    coalesce(c.slug, ''),
    coalesce(c.name, 'Sin categoría'),
    p.description,
    p.image_url,
    p.price,
    case
      when public.product_effective_stock(p.id) <= 0 then 'sin_stock'
      when public.product_effective_stock(p.id) <= p.min_stock then 'pocas_unidades'
      else 'disponible'
    end,
    p.image_urls,
    p.featured,
    p.badge
  from public.products p
  left join public.categories c on c.id = p.category_id
  where p.active and p.price > 0
  order by c.sort, p.name
$f$;

create or replace function public.business_report(p_from timestamptz, p_to timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $f$
declare
  tz constant text := 'America/Argentina/Buenos_Aires';
  v_d1 date;
  v_d2 date;
  r jsonb;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Sin permiso'; end if;
  v_d1 := (p_from at time zone tz)::date;
  v_d2 := (p_to at time zone tz)::date;

  with o as (
    select *
    from public.orders
    where status = 'confirmado' and confirmed_at >= p_from and confirmed_at < p_to
  ),
  li as (
    select
      (e->>'product_id')::uuid as pid,
      e->>'name' as name,
      (e->>'quantity')::int as qty,
      (e->>'unit_price')::numeric as up,
      coalesce((e->>'unit_cost')::numeric, 0) as uc
    from o, jsonb_array_elements(o.items) e
  )
  select jsonb_build_object(
    'ventas', coalesce((select sum(total) from o), 0),
    'pedidos', (select count(*) from o),
    'ticket_promedio', coalesce((select round(avg(total), 2) from o), 0),
    'costo_mercaderia', coalesce((select sum(cost_total) from o), 0),
    'pedidos_sin_costo', (select count(*) from o where cost_total <= 0),
    'gastos', coalesce((select sum(amount) from public.expenses where date >= v_d1 and date < v_d2), 0),
    'gastos_por_categoria', coalesce(
      (select jsonb_agg(t order by t.total desc)
       from (select category, sum(amount) as total from public.expenses
             where date >= v_d1 and date < v_d2 group by category) t),
      '[]'::jsonb
    ),
    'pendientes', (select count(*) from public.orders where status = 'pendiente'),
    'top_unidades', coalesce(
      (select jsonb_agg(t) from (select name, sum(qty)::int as unidades,
         sum(qty * up) as ventas, sum(qty * (up - uc)) as ganancia
       from li group by pid, name order by sum(qty) desc limit 10) t),
      '[]'::jsonb
    ),
    'top_ganancia', coalesce(
      (select jsonb_agg(t) from (select name, sum(qty)::int as unidades,
         sum(qty * up) as ventas, sum(qty * (up - uc)) as ganancia
       from li group by pid, name order by sum(qty * (up - uc)) desc limit 10) t),
      '[]'::jsonb
    ),
    'por_dia', coalesce(
      (select jsonb_agg(t order by t.dia) from
        (select (confirmed_at at time zone tz)::date as dia, count(*)::int as pedidos,
                sum(total) as ventas from o group by 1) t),
      '[]'::jsonb
    ),
    'inventario_costo', (select coalesce(sum(stock * cost), 0) from public.products where stock > 0),
    'inventario_precio', (select coalesce(sum(stock * price), 0) from public.products where stock > 0),
    'productos_sin_costo', (select count(*) from public.products where active and cost <= 0),
    'sin_movimiento_60d', (select count(*) from public.products p where p.active and p.stock > 0
      and not exists (select 1 from public.stock_movements m
        where m.product_id = p.id and m.type = 'salida'
          and m.created_at > now() - interval '60 days'))
  ) into r;

  return r;
end
$f$;

revoke all on function public.lock_and_check_product_stock(jsonb) from public, anon, authenticated;
revoke all on function public.product_effective_stock(uuid) from public, anon, authenticated;
revoke all on function public.product_effective_cost(uuid) from public, anon, authenticated;
revoke all on function public.consume_product_stock(uuid, int, text, uuid) from public, anon, authenticated;
revoke all on function public.business_report(timestamptz, timestamptz) from public, anon;
grant execute on function public.business_report(timestamptz, timestamptz) to authenticated;
revoke all on function public.get_public_products() from public;
grant execute on function public.get_public_products() to anon, authenticated;
