drop policy if exists "Personal crea productos" on public.products;
drop policy if exists "Admin crea productos" on public.products;
create policy "Admin crea productos"
  on public.products for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "Personal edita productos" on public.products;
drop policy if exists "Admin edita productos" on public.products;
create policy "Admin edita productos"
  on public.products for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create or replace function public.protect_product_internals_from_sellers()
returns trigger language plpgsql set search_path to 'public' as $f$
begin
  if public.has_role(auth.uid(), 'vendedor') and not public.has_role(auth.uid(), 'admin') then
    if tg_op = 'INSERT' then
      new.id := gen_random_uuid();
      new.created_at := now();
      new.updated_at := now();
      if new.cost is distinct from 0
        or new.supplier is distinct from ''
        or new.stock is distinct from 0
        or new.min_stock is distinct from 3
      then
        raise exception 'No tenés permiso para modificar costos, proveedores ni stock';
      end if;
    elsif new.id is distinct from old.id
      or new.slug is distinct from old.slug
      or new.created_at is distinct from old.created_at
      or new.cost is distinct from old.cost
      or new.supplier is distinct from old.supplier
      or new.stock is distinct from old.stock
      or new.min_stock is distinct from old.min_stock
    then
      raise exception 'No tenés permiso para modificar datos internos del producto';
    end if;
  end if;
  return new;
end $f$;

create trigger protect_product_internals_from_sellers
  before insert or update on public.products
  for each row execute function public.protect_product_internals_from_sellers();

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
  p_badge text
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
      slug, name, category_id, price, description, image_url, image_urls, featured, badge
    ) values (
      p_slug, btrim(p_name), p_category_id, p_price, coalesce(p_description, ''),
      coalesce(p_image_url, ''), coalesce(p_image_urls, '[]'::jsonb),
      coalesce(p_featured, false), coalesce(p_badge, '')
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
        badge = coalesce(p_badge, '')
    where id = p_product_id
    returning id into v_id;
    if v_id is null then raise exception 'Producto no encontrado'; end if;
  end if;
  return v_id;
end $f$;
revoke all on function public.save_staff_catalog_product(uuid, text, text, uuid, numeric, text, text, jsonb, boolean, text) from public, anon;
grant execute on function public.save_staff_catalog_product(uuid, text, text, uuid, numeric, text, text, jsonb, boolean, text) to authenticated;

create or replace function public.set_staff_product_active(p_product_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path to 'public' as $f$
begin
  if not public.has_role(auth.uid(), 'vendedor')
    or public.has_role(auth.uid(), 'admin')
  then raise exception 'Sin permiso'; end if;
  update public.products set active = p_active where id = p_product_id;
  if not found then raise exception 'Producto no encontrado'; end if;
end $f$;
revoke all on function public.set_staff_product_active(uuid, boolean) from public, anon;
grant execute on function public.set_staff_product_active(uuid, boolean) to authenticated;

create or replace function public.set_staff_product_photo(
  p_product_id uuid,
  p_image_url text,
  p_image_urls jsonb
)
returns void language plpgsql security definer set search_path to 'public' as $f$
begin
  if not public.has_role(auth.uid(), 'vendedor')
    or public.has_role(auth.uid(), 'admin')
  then raise exception 'Sin permiso'; end if;
  if jsonb_typeof(coalesce(p_image_urls, '[]'::jsonb)) <> 'array' then
    raise exception 'Fotos inválidas';
  end if;
  update public.products
  set image_url = coalesce(p_image_url, ''),
      image_urls = coalesce(p_image_urls, '[]'::jsonb)
  where id = p_product_id;
  if not found then raise exception 'Producto no encontrado'; end if;
end $f$;
revoke all on function public.set_staff_product_photo(uuid, text, jsonb) from public, anon;
grant execute on function public.set_staff_product_photo(uuid, text, jsonb) to authenticated;

drop policy if exists "Admin sube fotos" on storage.objects;
create policy "Personal sube fotos de productos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'productos' and public.is_staff(auth.uid()));

drop policy if exists "Admin cambia fotos" on storage.objects;
create policy "Personal cambia fotos de productos"
  on storage.objects for update to authenticated
  using (bucket_id = 'productos' and public.is_staff(auth.uid()))
  with check (bucket_id = 'productos' and public.is_staff(auth.uid()));

drop policy if exists "Admin borra fotos" on storage.objects;
create policy "Personal borra fotos de productos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'productos' and public.is_staff(auth.uid()));

create or replace function public.link_product_photos(p_base_url text)
returns int language plpgsql security definer set search_path to 'public' as $f$
declare v_n int;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Sin permiso'; end if;
  with objs as (
    select o.name, rtrim(p_base_url, '/') || '/' || o.name as url
    from storage.objects o
    where o.bucket_id = 'productos' and o.name ~ '^[a-z0-9-]+\.webp$'
  ),
  mains as (
    select p.id, ob.url from objs ob
    join public.products p on p.slug = regexp_replace(ob.name, '\.webp$', '')
  ),
  extras as (
    select p.id, ob.url, (regexp_match(ob.name, '-([0-9]+)\.webp$'))[1]::int as n
    from objs ob
    join public.products p on p.slug = regexp_replace(ob.name, '-[0-9]+\.webp$', '')
    where ob.name ~ '-[0-9]+\.webp$'
  ),
  u as (
    update public.products p
    set image_url = m.url,
        image_urls = jsonb_build_array(m.url) || coalesce(
          (select jsonb_agg(e.url order by e.n) from extras e where e.id = p.id),
          '[]'::jsonb
        )
    from mains m
    where p.id = m.id
    returning 1
  )
  select count(*) into v_n from u;
  return v_n;
end $f$;
revoke execute on function public.link_product_photos(text) from public, anon;
grant execute on function public.link_product_photos(text) to authenticated;

create table public.business_drive_links (
  id integer primary key default 1 check (id = 1),
  photos_url text not null default '',
  spreadsheets_url text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.business_drive_links (id) values (1) on conflict (id) do nothing;
alter table public.business_drive_links enable row level security;
grant select, insert, update on public.business_drive_links to authenticated;
create policy "Personal consulta enlaces internos de Drive"
  on public.business_drive_links for select to authenticated
  using (public.is_staff(auth.uid()));
create policy "Admin gestiona enlaces internos de Drive"
  on public.business_drive_links for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));
