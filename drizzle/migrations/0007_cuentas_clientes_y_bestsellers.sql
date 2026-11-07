drop trigger if exists on_auth_user_created_first_admin on auth.users;
drop function if exists public.handle_first_admin();

alter table public.orders
  add column if not exists customer_user_id uuid references auth.users(id) on delete set null;

create index if not exists orders_customer_user_created_idx
  on public.orders (customer_user_id, created_at desc)
  where customer_user_id is not null;

create table public.customer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  street text not null default '',
  street_number text not null default '',
  unit text not null default '',
  neighborhood text not null default '',
  city text not null default '',
  province text not null default '',
  postal_code text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.customer_profiles enable row level security;
grant select, insert, update on public.customer_profiles to authenticated;

create policy "Clientes ven su perfil"
  on public.customer_profiles for select to authenticated
  using (auth.uid() = user_id and not public.is_staff(auth.uid()));
create policy "Clientes crean su perfil"
  on public.customer_profiles for insert to authenticated
  with check (auth.uid() = user_id and not public.is_staff(auth.uid()));
create policy "Clientes actualizan su perfil"
  on public.customer_profiles for update to authenticated
  using (auth.uid() = user_id and not public.is_staff(auth.uid()))
  with check (auth.uid() = user_id and not public.is_staff(auth.uid()));

create or replace function public.attach_customer_to_order()
returns trigger language plpgsql security definer set search_path to 'public' as $f$
begin
  if auth.uid() is not null and not public.is_staff(auth.uid()) then
    new.customer_user_id := auth.uid();
  else
    new.customer_user_id := null;
  end if;
  return new;
end $f$;

revoke all on function public.attach_customer_to_order() from public, anon, authenticated;
drop trigger if exists orders_attach_customer on public.orders;
create trigger orders_attach_customer
  before insert on public.orders
  for each row execute function public.attach_customer_to_order();

create or replace function public.customer_order_history()
returns table (
  order_id uuid,
  order_number integer,
  created_at timestamptz,
  status text,
  delivered_at timestamptz,
  total numeric,
  items jsonb,
  delivery_method text,
  delivery_address jsonb,
  event_date date,
  notes text
)
language plpgsql stable security definer set search_path to 'public' as $f$
begin
  if auth.uid() is null or public.is_staff(auth.uid()) then
    raise exception 'Solo disponible para cuentas de clientes';
  end if;

  return query
    select o.id, o.number, o.created_at, o.status::text, o.delivered_at, o.total,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'name', e->>'name',
          'quantity', e->>'quantity',
          'unit_price', e->>'unit_price'
        ) order by item.ordinality)
        from jsonb_array_elements(o.items) with ordinality as item(e, ordinality)
      ), '[]'::jsonb),
      o.delivery_method, o.delivery_address, o.event_date, o.notes
    from public.orders o
    where o.customer_user_id = auth.uid()
    order by o.created_at desc;
end $f$;

revoke all on function public.customer_order_history() from public, anon;
grant execute on function public.customer_order_history() to authenticated;

create or replace function public.get_public_bestsellers()
returns table (slug text)
language sql stable security definer set search_path to 'public' as $f$
  with sold as (
    select e->>'product_id' as product_id,
      sum(case
        when (e->>'quantity') ~ '^[0-9]{1,6}$' then (e->>'quantity')::int
        else 0
      end)::bigint as units
    from public.orders o
    cross join lateral jsonb_array_elements(o.items) as item(e)
    where o.status = 'confirmado'
    group by e->>'product_id'
  )
  select p.slug
  from sold s
  join public.products p on p.id::text = s.product_id and p.active
  left join public.categories c on c.id = p.category_id
  where coalesce(c.slug, '') not in ('combos', 'cotillon')
  order by s.units desc, p.name
  limit 8
$f$;

revoke all on function public.get_public_bestsellers() from public;
grant execute on function public.get_public_bestsellers() to anon, authenticated;
