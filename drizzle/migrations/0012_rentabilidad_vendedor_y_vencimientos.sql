alter table public.products
  add column if not exists expiration_date date;

create or replace view public.products_staff as
  select p.id, p.slug, p.name, p.category_id, p.description, p.image_url, p.price, p.stock,
         p.min_stock, p.active, p.created_at, p.updated_at, p.image_urls, p.featured, p.badge,
         case
           when exists (select 1 from public.combo_items ci where ci.combo_id = p.id)
           then coalesce((
             select min(floor(greatest(c.stock, 0)::numeric / ci.quantity))::int
             from public.combo_items ci
             join public.products c on c.id = ci.component_id
             where ci.combo_id = p.id
           ), 0)
           else p.stock
         end as stock_disponible,
         p.cost, p.expiration_date
  from public.products p
  where public.is_staff(auth.uid());
revoke all on public.products_staff from public, anon;
grant select on public.products_staff to authenticated;

create or replace view public.orders_staff as
  select id, number, customer_name, customer_phone, items, total, status, channel, created_at,
         confirmed_at, customer_email, delivery_method, delivery_address, event_date, notes,
         delivered_at, edited_at, cost_total
  from public.orders
  where public.is_staff(auth.uid());
revoke all on public.orders_staff from public, anon;
grant select on public.orders_staff to authenticated;

create or replace function public.business_report(p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql stable security definer set search_path to 'public' as $f$
declare tz constant text := 'America/Argentina/Buenos_Aires'; v_d1 date; v_d2 date; r jsonb;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Sin permiso'; end if;
  v_d1 := (p_from at time zone tz)::date; v_d2 := (p_to at time zone tz)::date;
  with o as (
    select * from public.orders
    where status = 'confirmado' and confirmed_at >= p_from and confirmed_at < p_to
  ),
  li as (
    select (e->>'product_id')::uuid as pid, e->>'name' as name,
           (e->>'quantity')::int as qty, (e->>'unit_price')::numeric as up,
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
end $f$;
revoke all on function public.business_report(timestamptz, timestamptz) from public, anon;
grant execute on function public.business_report(timestamptz, timestamptz) to authenticated;

drop function if exists public.save_staff_catalog_product(
  uuid, text, text, uuid, numeric, text, text, jsonb, boolean, text
);
create or replace function public.save_staff_catalog_product(
  p_product_id uuid,
  p_slug text,
  p_name text,
  p_category_id uuid,
  p_price numeric,
  p_description text,
  p_image_url text,
  p_image_urls jsonb,
  p_featured boolean,
  p_badge text,
  p_expiration_date date
)
returns uuid language plpgsql security definer set search_path to 'public' as $f$
declare v_id uuid;
begin
  if not public.has_role(auth.uid(), 'vendedor')
    or public.has_role(auth.uid(), 'admin')
  then raise exception 'Sin permiso'; end if;
  if length(btrim(coalesce(p_name, ''))) < 2 or length(p_name) > 120
    or p_price is null or p_price <= 0
    or length(coalesce(p_description, '')) > 500
    or length(coalesce(p_badge, '')) > 40
    or jsonb_typeof(coalesce(p_image_urls, '[]'::jsonb)) <> 'array'
  then raise exception 'Datos de producto inválidos'; end if;

  if p_product_id is null then
    insert into public.products (
      slug, name, category_id, price, description, image_url, image_urls, featured, badge, expiration_date
    ) values (
      p_slug, btrim(p_name), p_category_id, p_price, coalesce(p_description, ''),
      coalesce(p_image_url, ''), coalesce(p_image_urls, '[]'::jsonb),
      coalesce(p_featured, false), coalesce(p_badge, ''), p_expiration_date
    )
    returning id into v_id;
  else
    update public.products
    set name = btrim(p_name),
        category_id = p_category_id,
        price = p_price,
        description = coalesce(p_description, ''),
        image_url = coalesce(p_image_url, ''),
        image_urls = coalesce(p_image_urls, '[]'::jsonb),
        featured = coalesce(p_featured, false),
        badge = coalesce(p_badge, ''),
        expiration_date = p_expiration_date
    where id = p_product_id
    returning id into v_id;
    if v_id is null then raise exception 'Producto no encontrado'; end if;
  end if;
  return v_id;
end $f$;
revoke all on function public.save_staff_catalog_product(
  uuid, text, text, uuid, numeric, text, text, jsonb, boolean, text, date
) from public, anon;
grant execute on function public.save_staff_catalog_product(
  uuid, text, text, uuid, numeric, text, text, jsonb, boolean, text, date
) to authenticated;
