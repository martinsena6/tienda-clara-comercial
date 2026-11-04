-- 02: PEDIDO COMPLETO
select setval('public.orders_number_seq', coalesce((select max(number) from public.orders), 0) + 1, false);

alter table public.orders
  add column if not exists customer_email text not null default '',
  add column if not exists delivery_method text not null default 'retiro',
  add column if not exists delivery_address jsonb not null default '{}'::jsonb,
  add column if not exists event_date date,
  add column if not exists notes text not null default '',
  add column if not exists delivered_at timestamptz,
  add column if not exists edited_at timestamptz;
alter table public.orders add constraint orders_delivery_method_check check (delivery_method in ('retiro', 'envio'));
create index if not exists orders_event_date_idx on public.orders (event_date) where event_date is not null;

create or replace view public.orders_staff as
  select id, number, customer_name, customer_phone,
         (select coalesce(jsonb_agg(e - 'unit_cost' order by n), '[]'::jsonb) from jsonb_array_elements(items) with ordinality as t(e, n)) as items,
         total, status, channel, created_at, confirmed_at,
         customer_email, delivery_method, delivery_address, event_date, notes, delivered_at, edited_at
  from public.orders where public.is_staff(auth.uid());

drop function if exists public.create_order(jsonb, text);
create or replace function public.create_order(
  p_items jsonb, p_customer_name text default '', p_customer_phone text default '',
  p_delivery_method text default 'retiro', p_delivery_address jsonb default '{}'::jsonb,
  p_event_date date default null, p_notes text default '', p_customer_email text default '', p_hp text default '')
returns table(order_number integer, total numeric, items jsonb)
language plpgsql security definer set search_path to 'public' as $f$
declare
  v_items jsonb := '[]'; v_total numeric := 0; r record; v_num int; v_found int := 0; v_requested int; v_addr jsonb := '{}'::jsonb;
  v_phone text := regexp_replace(coalesce(p_customer_phone, ''), '\D', '', 'g');
  v_name text := btrim(coalesce(p_customer_name, ''));
  v_today date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  if coalesce(p_hp, '') <> '' then raise exception 'Pedido inválido'; end if;
  if length(v_name) < 2 or length(v_name) > 120 then raise exception 'Ingresá tu nombre y apellido'; end if;
  if length(v_phone) < 8 or length(v_phone) > 15 then raise exception 'Ingresá un celular válido'; end if;
  if p_delivery_method not in ('retiro', 'envio') then raise exception 'Método de entrega inválido'; end if;
  if p_delivery_method = 'envio' then
    v_addr := jsonb_build_object('street', left(btrim(coalesce(p_delivery_address->>'street', '')), 150), 'city', left(btrim(coalesce(p_delivery_address->>'city', '')), 80),
      'province', left(btrim(coalesce(p_delivery_address->>'province', '')), 80), 'postal_code', left(btrim(coalesce(p_delivery_address->>'postal_code', '')), 12));
    if v_addr->>'street' = '' or v_addr->>'city' = '' then raise exception 'Ingresá la dirección de entrega'; end if;
  end if;
  if p_event_date is not null and (p_event_date < v_today or p_event_date > v_today + 366) then raise exception 'La fecha del evento no es válida'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 40 then raise exception 'Pedido inválido'; end if;
  if (select count(*) from public.orders o where o.status = 'pendiente' and regexp_replace(o.customer_phone, '\D', '', 'g') = v_phone and o.created_at > now() - interval '24 hours') >= 3 then
    raise exception 'Ya tenés pedidos pendientes. Escribinos por WhatsApp'; end if;
  if (select count(*) from public.orders o where o.status = 'pendiente') >= 200 then raise exception 'Estamos recibiendo muchos pedidos. Escribinos por WhatsApp'; end if;
  for r in
    select p.id, p.name, p.price, least(q.qty, 99)::int as qty
    from (select i->>'slug' as slug, sum(case when (i->>'quantity') ~ '^[0-9]{1,3}$' then greatest((i->>'quantity')::int, 1) else 1 end) as qty from jsonb_array_elements(p_items) i group by 1) q
    join public.products p on p.slug = q.slug and p.active and p.price > 0
  loop
    v_items := v_items || jsonb_build_object('product_id', r.id, 'name', r.name, 'quantity', r.qty, 'unit_price', r.price);
    v_total := v_total + r.qty * r.price;
    v_found := v_found + 1;
  end loop;
  select count(distinct i->>'slug') into v_requested from jsonb_array_elements(p_items) i;
  if v_found = 0 or v_found <> v_requested then raise exception 'Algún producto ya no está disponible. Revisá tu carrito'; end if;
  insert into public.orders (customer_name, customer_phone, customer_email, items, total, delivery_method, delivery_address, event_date, notes)
    values (v_name, left(btrim(p_customer_phone), 40), left(btrim(coalesce(p_customer_email, '')), 120), v_items, v_total, p_delivery_method, v_addr, p_event_date, left(btrim(coalesce(p_notes, '')), 300))
    returning number into v_num;
  return query select v_num, v_total, v_items;
end $f$;

create or replace function public.update_order_items(p_order_id uuid, p_items jsonb)
returns numeric language plpgsql security definer set search_path to 'public' as $f$
declare o record; v_items jsonb := '[]'; v_total numeric := 0; it record; ex jsonb; v_price numeric; v_name text;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Sin permiso'; end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Datos inválidos'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then raise exception 'Pedido no encontrado'; end if;
  if o.status <> 'pendiente' then raise exception 'Solo se pueden editar pedidos pendientes'; end if;
  for it in select (i->>'product_id')::uuid as pid, (i->>'quantity')::int as qty from jsonb_array_elements(p_items) i loop
    if it.qty is null or it.qty < 0 or it.qty > 999 then raise exception 'Cantidad inválida'; end if;
    continue when it.qty = 0;
    ex := null; v_name := null;
    select e into ex from jsonb_array_elements(o.items) e where (e->>'product_id')::uuid = it.pid limit 1;
    if ex is not null then v_price := (ex->>'unit_price')::numeric; v_name := ex->>'name';
    else
      select name, price into v_name, v_price from public.products where id = it.pid and active;
      if v_name is null then raise exception 'Producto no disponible'; end if;
    end if;
    v_items := v_items || jsonb_build_object('product_id', it.pid, 'name', v_name, 'quantity', it.qty, 'unit_price', v_price);
    v_total := v_total + it.qty * v_price;
  end loop;
  if jsonb_array_length(v_items) = 0 then raise exception 'El pedido no puede quedar vacío: cancelalo'; end if;
  update public.orders set items = v_items, total = v_total, edited_at = now() where id = p_order_id;
  return v_total;
end $f$;

create or replace function public.create_counter_sale(p_items jsonb, p_note text default '', p_allow_negative boolean default true)
returns table(order_number int, order_total numeric)
language plpgsql security definer set search_path to 'public' as $f$
declare v_items jsonb := '[]'; v_total numeric := 0; v_cost numeric := 0; it record; p record; v_num int; v_price numeric;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Sin permiso'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 60 then raise exception 'Venta sin productos'; end if;
  v_num := nextval('public.orders_number_seq');
  for it in select (i->>'product_id')::uuid as pid, (i->>'quantity')::int as qty, nullif(i->>'unit_price', '')::numeric as up from jsonb_array_elements(p_items) i loop
    if it.qty is null or it.qty < 1 or it.qty > 999 then raise exception 'Cantidad inválida'; end if;
    select id, name, price, cost, stock into p from public.products where id = it.pid for update;
    if p.id is null then raise exception 'Producto inexistente'; end if;
    if not p_allow_negative and p.stock < it.qty then raise exception 'Stock insuficiente: % (hay %, pedido %)', p.name, p.stock, it.qty; end if;
    v_price := coalesce(it.up, p.price);
    if v_price < 0 then raise exception 'Precio inválido'; end if;
    v_items := v_items || jsonb_build_object('product_id', p.id, 'name', p.name, 'quantity', it.qty, 'unit_price', v_price, 'unit_cost', p.cost);
    v_total := v_total + it.qty * v_price; v_cost := v_cost + it.qty * p.cost;
    insert into public.stock_movements (product_id, type, quantity, reason, user_id) values (p.id, 'salida', -it.qty, 'Venta mostrador #' || v_num, auth.uid());
    update public.products set stock = stock - it.qty where id = p.id;
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
    if exists (select 1 from public.products where id = (it->>'product_id')::uuid) then
      insert into public.stock_movements (product_id, type, quantity, reason, user_id) values ((it->>'product_id')::uuid, 'entrada', (it->>'quantity')::int, 'Anulación venta #' || o.number, auth.uid());
      update public.products set stock = stock + (it->>'quantity')::int where id = (it->>'product_id')::uuid;
    end if;
  end loop;
  update public.orders set status = 'cancelado', notes = btrim(notes || ' | Anulada: ' || left(coalesce(p_reason, ''), 150)) where id = p_order_id;
end $f$;

create or replace function public.mark_order_delivered(p_order_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $f$
begin
  if not public.is_staff(auth.uid()) then raise exception 'Sin permiso'; end if;
  update public.orders set delivered_at = now() where id = p_order_id and status = 'confirmado' and delivered_at is null;
end $f$;

create or replace function public.expire_pending_orders(p_hours int default 48)
returns int language plpgsql security definer set search_path to 'public' as $f$
declare v_n int;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Sin permiso'; end if;
  with c as (update public.orders set status = 'cancelado', notes = btrim(notes || ' | Vencido sin confirmar') where status = 'pendiente' and created_at < now() - make_interval(hours => p_hours) returning 1)
  select count(*) into v_n from c;
  return v_n;
end $f$;

revoke execute on function public.create_order(jsonb, text, text, text, jsonb, date, text, text, text) from public;
grant execute on function public.create_order(jsonb, text, text, text, jsonb, date, text, text, text) to anon, authenticated;
do $$ declare v_row record; begin
  for v_row in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in ('update_order_items', 'create_counter_sale', 'void_confirmed_order', 'mark_order_delivered', 'expire_pending_orders') loop
    execute format('revoke execute on function %s from public, anon', v_row.sig);
    execute format('grant execute on function %s to authenticated', v_row.sig);
  end loop;
end $$;