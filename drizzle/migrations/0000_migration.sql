-- Roles
create type public.app_role as enum ('admin', 'vendedor');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Ver mis roles" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- El primer usuario registrado queda como administrador
create or replace function public.handle_first_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_created_first_admin after insert on auth.users
  for each row execute function public.handle_first_admin();

create or replace function public.is_staff(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id)
$$;

-- updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

-- Configuración del negocio (pública)
create table public.business_settings (
  id int primary key default 1 check (id = 1),
  name text not null default 'Festiva',
  whatsapp text not null default '',
  instagram text not null default '',
  tiktok text not null default '',
  address text not null default '',
  hours text not null default '',
  email text not null default '',
  updated_at timestamptz not null default now()
);
grant select on public.business_settings to anon, authenticated;
grant update on public.business_settings to authenticated;
grant all on public.business_settings to service_role;
alter table public.business_settings enable row level security;
create policy "Configuración pública" on public.business_settings for select to anon, authenticated using (true);
create policy "Admin edita configuración" on public.business_settings for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create trigger t_settings_updated before update on public.business_settings for each row execute function public.touch_updated_at();

-- Categorías (públicas)
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort int not null default 0
);
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "Categorías públicas" on public.categories for select to anon, authenticated using (true);
create policy "Admin gestiona categorías" on public.categories for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Productos (internos: costo, proveedor, stock)
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  description text not null default '',
  image_url text not null default '',
  price numeric(12,2) not null default 0 check (price >= 0),
  cost numeric(12,2) not null default 0 check (cost >= 0),
  supplier text not null default '',
  stock int not null default 0,
  min_stock int not null default 3,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.products to authenticated;
grant all on public.products to service_role;
alter table public.products enable row level security;
create policy "Personal ve productos" on public.products for select to authenticated using (public.is_staff(auth.uid()));
create policy "Admin crea productos" on public.products for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "Admin edita productos" on public.products for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "Admin borra productos" on public.products for delete to authenticated using (public.has_role(auth.uid(), 'admin'));
create trigger t_products_updated before update on public.products for each row execute function public.touch_updated_at();

-- Vista pública segura del catálogo (sin costo, proveedor ni cantidades)
create or replace function public.get_public_products()
returns table (slug text, name text, category_slug text, category_name text, description text, image_url text, price numeric, availability text)
language sql stable security definer set search_path = public as $$
  select p.slug, p.name, coalesce(c.slug, ''), coalesce(c.name, 'Sin categoría'), p.description, p.image_url, p.price,
    case when p.stock <= 0 then 'sin_stock' when p.stock <= p.min_stock then 'pocas_unidades' else 'disponible' end
  from public.products p left join public.categories c on c.id = p.category_id
  where p.active
  order by c.sort, p.name
$$;
grant execute on function public.get_public_products() to anon, authenticated;

-- Movimientos de stock
create type public.stock_movement_type as enum ('entrada', 'salida', 'ajuste');
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  type public.stock_movement_type not null,
  quantity int not null,
  reason text not null default '',
  user_id uuid,
  created_at timestamptz not null default now()
);
grant select on public.stock_movements to authenticated;
grant all on public.stock_movements to service_role;
alter table public.stock_movements enable row level security;
create policy "Personal ve movimientos" on public.stock_movements for select to authenticated using (public.is_staff(auth.uid()));

-- Pedidos
create type public.order_status as enum ('pendiente', 'confirmado', 'cancelado');
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  number serial unique,
  customer_name text not null default '',
  customer_phone text not null default '',
  items jsonb not null default '[]',
  total numeric(12,2) not null default 0,
  status public.order_status not null default 'pendiente',
  channel text not null default 'whatsapp',
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
grant select, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "Personal ve pedidos" on public.orders for select to authenticated using (public.is_staff(auth.uid()));

-- Crear pedido desde el carrito: precios leídos de la base, nunca del navegador
create or replace function public.create_order(p_items jsonb, p_customer_name text default '')
returns table (order_number int, total numeric, items jsonb)
language plpgsql security definer set search_path = public as $$
declare
  v_items jsonb := '[]';
  v_total numeric := 0;
  r record;
  v_num int;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'Pedido inválido';
  end if;
  for r in
    select p.id, p.name, p.price, least(greatest((i->>'quantity')::int, 1), 999) as qty
    from jsonb_array_elements(p_items) i
    join public.products p on p.slug = i->>'slug' and p.active
  loop
    v_items := v_items || jsonb_build_object('product_id', r.id, 'name', r.name, 'quantity', r.qty, 'unit_price', r.price);
    v_total := v_total + r.qty * r.price;
  end loop;
  if jsonb_array_length(v_items) = 0 then raise exception 'Pedido sin productos válidos'; end if;
  insert into public.orders (customer_name, items, total) values (left(coalesce(p_customer_name, ''), 120), v_items, v_total)
    returning number into v_num;
  return query select v_num, v_total, v_items;
end $$;
grant execute on function public.create_order(jsonb, text) to anon, authenticated;

-- Confirmar pedido: única forma de descontar stock por venta
create or replace function public.confirm_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare o record; it jsonb;
begin
  if not public.is_staff(auth.uid()) then raise exception 'Sin permiso'; end if;
  select * into o from public.orders where id = p_order_id for update;
  if o is null then raise exception 'Pedido no encontrado'; end if;
  if o.status <> 'pendiente' then raise exception 'El pedido ya no está pendiente'; end if;
  for it in select * from jsonb_array_elements(o.items) loop
    insert into public.stock_movements (product_id, type, quantity, reason, user_id)
      select (it->>'product_id')::uuid, 'salida', -((it->>'quantity')::int), 'Venta confirmada #' || o.number, auth.uid()
      where exists (select 1 from public.products where id = (it->>'product_id')::uuid);
    update public.products set stock = stock - (it->>'quantity')::int where id = (it->>'product_id')::uuid;
  end loop;
  update public.orders set status = 'confirmado', confirmed_at = now() where id = p_order_id;
end $$;
grant execute on function public.confirm_order(uuid) to authenticated;

create or replace function public.cancel_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff(auth.uid()) then raise exception 'Sin permiso'; end if;
  update public.orders set status = 'cancelado' where id = p_order_id and status = 'pendiente';
end $$;
grant execute on function public.cancel_order(uuid) to authenticated;

-- Ajuste manual de stock (queda registrado)
create or replace function public.adjust_stock(p_product_id uuid, p_type public.stock_movement_type, p_quantity int, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_delta int;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Sin permiso'; end if;
  v_delta := case p_type when 'entrada' then abs(p_quantity) when 'salida' then -abs(p_quantity) else p_quantity end;
  insert into public.stock_movements (product_id, type, quantity, reason, user_id) values (p_product_id, p_type, v_delta, left(coalesce(p_reason,''),200), auth.uid());
  update public.products set stock = stock + v_delta where id = p_product_id;
end $$;
grant execute on function public.adjust_stock(uuid, public.stock_movement_type, int, text) to authenticated;

-- Datos iniciales
insert into public.business_settings (id, name, whatsapp, instagram, tiktok, address, hours, email) values
 (1, 'Festiva', '5493625436293', 'festiva.rcia', 'festiva.rcia', 'Salta 124, Galería Mariana, Local N°1',
  'Lunes a sábado de 9:00 a 12:30 y de 17:30 a 20:30', '');

insert into public.categories (slug, name, sort) values
 ('golosinas','Golosinas y chicles',1),('chupetines','Chupetines',2),('gomitas','Gomitas',3),('combos','Combos para fiestas',4),('cotillon','Cotillón',5);

insert into public.products (slug, name, category_id, description, image_url, price, cost, supplier, stock, min_stock) values
 ('combo-10-misky','Combo 10 Misky',(select id from public.categories where slug='combos'),'10 alfajores Mogy, 10 turrones Misky, 10 chupetines Pelotitas, 10 bocaditos Bel y 20 masticables. 60 unidades.','asset:combo-misky-10',12600,8190,'A definir',8,3),
 ('combo-20-misky','Combo 20 Misky',(select id from public.categories where slug='combos'),'20 alfajores Mogy, 20 turrones Misky, 20 chupetines Pelotitas, 20 bocaditos Bel y 40 masticables. 120 unidades.','asset:combo-misky-20',25100,16315,'A definir',5,3),
 ('combo-10-economico','Combo 10 Económico',(select id from public.categories where slug='combos'),'10 alfajores Tinchito, 10 turrones Fulbito, 10 chupetines, 10 bocaditos Bel y 20 masticables. 60 unidades.','asset:combo-eco-10',9800,6370,'A definir',10,3),
 ('combo-20-economico','Combo 20 Económico',(select id from public.categories where slug='combos'),'20 alfajores, 20 turrones, 20 chupetines, 20 bocaditos y 40 masticables. 120 unidades.','asset:combo-eco-20',19500,12675,'A definir',4,3),
 ('combo-40-economico','Combo 40 Económico',(select id from public.categories where slug='combos'),'40 alfajores, 40 turrones, 40 chupetines, 40 bocaditos y 80 masticables. 240 unidades.','asset:combo-eco-40',39000,25350,'A definir',2,3),
 ('bola-loca-futbol','Bola Loca Fútbol',(select id from public.categories where slug='golosinas'),'Chicles Bola Loca Fútbol Club, bolsa surtida.','asset:bola-loca-futbol',2871.65,1866.57,'A definir',15,3),
 ('chupetin-emoji','Chupetín Emoji',(select id from public.categories where slug='chupetines'),'Chupetines Pop Emo con caritas, bolsa.','asset:chupetin-emoji',3955.02,2570.76,'A definir',12,3),
 ('chupetin-cebollita','Chupetín Cebollita',(select id from public.categories where slug='chupetines'),'Chupetines Cebollitas Fútbol de Lheritier.','asset:chupetin-cebollita',1354.12,880.18,'A definir',20,3),
 ('chupetin-pico-dulce','Chupetín Pico Dulce',(select id from public.categories where slug='chupetines'),'Caja de chupetines Pico Dulce, 24 unidades.','asset:chupetin-pico-dulce',4381.2,2847.78,'A definir',3,3),
 ('goma-mogul-anillos','Gomitas Mogul Anillos 1 kg',(select id from public.categories where slug='gomitas'),'Gomitas Mogul en forma de anillo, bolsa de 1 kg.','asset:goma-mogul-anillos',9783,6358.95,'A definir',6,3),
 ('docigoma-gajo','Docigoma Gajo',(select id from public.categories where slug='gomitas'),'Gomitas Docile en forma de gajo.','asset:docigoma-gajo',2698.29,1753.89,'A definir',10,3),
 ('goma-ricomas-jelly','Gomitas Ricomas Jelly Roll 500 g',(select id from public.categories where slug='gomitas'),'Gomitas Ricomas de Misky, bolsa de 500 g.','asset:goma-ricomas-jelly',4030.91,2620.09,'A definir',0,3),
 ('goma-pinata','Gomitas La Piñata 700 g',(select id from public.categories where slug='gomitas'),'Gomitas La Piñata anillos azucarados, 700 g.','asset:goma-pinata',4961.67,3225.09,'A definir',7,3),
 ('goma-fierita-roll','Gomitas Fierita Roll',(select id from public.categories where slug='gomitas'),'Caja de gomitas Fierita en rollo.','asset:goma-fierita-roll',5342.89,3472.88,'A definir',4,3);
