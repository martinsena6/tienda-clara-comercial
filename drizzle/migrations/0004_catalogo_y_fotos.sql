alter table public.products
  add column if not exists image_urls jsonb not null default '[]'::jsonb,
  add column if not exists featured boolean not null default false,
  add column if not exists badge text not null default '';

create or replace view public.products_staff as
  select id, slug, name, category_id, description, image_url, price, stock, min_stock, active, created_at, updated_at, image_urls, featured, badge
  from public.products where public.is_staff(auth.uid());
revoke all on public.products_staff from public, anon;
grant select on public.products_staff to authenticated;

create table public.banners (
  id uuid primary key default gen_random_uuid(), title text not null default '', subtitle text not null default '',
  image_url text not null default '', link text not null default '', active boolean not null default true,
  sort int not null default 0, created_at timestamptz not null default now());
alter table public.banners enable row level security;
create policy "Banners activos públicos" on public.banners for select to anon, authenticated using (active);
create policy "Admin gestiona banners" on public.banners for all to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

drop function if exists public.get_public_products();
create function public.get_public_products()
returns table(slug text, name text, category_slug text, category_name text, description text, image_url text, price numeric, availability text, image_urls jsonb, featured boolean, badge text)
language sql stable security definer set search_path to 'public' as $f$
  select p.slug, p.name, coalesce(c.slug, ''), coalesce(c.name, 'Sin categoría'), p.description, p.image_url, p.price,
    case when p.stock <= 0 then 'sin_stock' when p.stock <= p.min_stock then 'pocas_unidades' else 'disponible' end,
    p.image_urls, p.featured, p.badge
  from public.products p left join public.categories c on c.id = p.category_id
  where p.active order by c.sort, p.name
$f$;
revoke execute on function public.get_public_products() from public;
grant execute on function public.get_public_products() to anon, authenticated;

create or replace function public.link_product_photos(p_base_url text)
returns int language plpgsql security definer set search_path to 'public' as $f$
declare v_n int;
begin
  if auth.uid() is not null and not public.has_role(auth.uid(), 'admin') then raise exception 'Sin permiso'; end if;
  with objs as (select o.name, rtrim(p_base_url, '/') || '/' || o.name as url from storage.objects o where o.bucket_id = 'productos' and o.name ~ '^[a-z0-9-]+\.webp$'),
  mains as (select p.id, ob.url from objs ob join public.products p on p.slug = regexp_replace(ob.name, '\.webp$', '')),
  extras as (select p.id, ob.url, (regexp_match(ob.name, '-([0-9]+)\.webp$'))[1]::int as n from objs ob join public.products p on p.slug = regexp_replace(ob.name, '-[0-9]+\.webp$', '') where ob.name ~ '-[0-9]+\.webp$'),
  u as (update public.products p set image_url = m.url, image_urls = jsonb_build_array(m.url) || coalesce((select jsonb_agg(e.url order by e.n) from extras e where e.id = p.id), '[]'::jsonb)
        from mains m where p.id = m.id returning 1)
  select count(*) into v_n from u;
  return v_n;
end $f$;
revoke execute on function public.link_product_photos(text) from public, anon;
grant execute on function public.link_product_photos(text) to authenticated;
