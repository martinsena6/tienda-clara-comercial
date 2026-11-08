-- Aligns the deployed catalog-save function with the current staff roles.
-- Safe to apply after either migration 0012 or the equivalent SQL Editor script.
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
  if not public.is_staff(auth.uid()) then
    raise exception 'Sin permiso';
  end if;
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
