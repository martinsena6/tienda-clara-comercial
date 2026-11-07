do $$
declare
  v_owner_id uuid;
begin
  select id into v_owner_id
  from auth.users
  where lower(email) = 'samantacondeolgado@gmail.com'
    and email_confirmed_at is not null
  limit 1;

  if v_owner_id is null then
    raise exception 'No existe una cuenta confirmada para samantacondeolgado@gmail.com. Creala y confirmá el correo antes de aplicar esta migración.';
  end if;

  delete from public.user_roles
  where role = 'propietario_local' and user_id <> v_owner_id;

  delete from public.user_roles
  where user_id = v_owner_id;

  insert into public.user_roles (user_id, role)
  values (v_owner_id, 'propietario_local');
end
$$;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and (
        role = _role
        or (_role = 'admin' and role = 'propietario_local')
      )
  )
$$;

create or replace function public.is_app_owner(_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = 'admin'
  )
$$;
revoke all on function public.is_app_owner(uuid) from public, anon;
grant execute on function public.is_app_owner(uuid) to authenticated;

drop policy if exists "Ver mis roles" on public.user_roles;
create policy "Ver mis roles" on public.user_roles for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_app_owner(auth.uid())
  );

create or replace function public.list_team()
returns table(user_id uuid, email text, role public.app_role, created_at timestamptz)
language plpgsql stable security definer set search_path to 'public' as $f$
begin
  if not public.is_app_owner(auth.uid()) then raise exception 'Sin permiso'; end if;
  return query
    select u.id, u.email::text, r.role, u.created_at
    from auth.users u
    left join public.user_roles r on r.user_id = u.id
    order by u.created_at;
end $f$;

create or replace function public.set_user_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path to 'public' as $f$
begin
  if not public.is_app_owner(auth.uid()) then raise exception 'Sin permiso'; end if;
  if p_user_id = auth.uid() then raise exception 'No podés cambiar tu propio rol'; end if;
  if exists (
    select 1 from public.user_roles
    where user_id = p_user_id and role = 'propietario_local'
  ) then raise exception 'No se puede cambiar el rol del dueño del local'; end if;
  if p_role not in ('vendedor', 'ninguno') then
    raise exception 'Solo el dueño de la app puede asignar permisos de administrador';
  end if;
  delete from public.user_roles where user_id = p_user_id;
  if p_role = 'vendedor' then
    insert into public.user_roles (user_id, role) values (p_user_id, 'vendedor');
  end if;
end $f$;

create table public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.staff_profiles enable row level security;
grant select, insert, update on public.staff_profiles to authenticated;

create policy "Personal ve su perfil"
  on public.staff_profiles for select to authenticated
  using (auth.uid() = user_id and public.is_staff(auth.uid()));
create policy "Personal crea su perfil"
  on public.staff_profiles for insert to authenticated
  with check (auth.uid() = user_id and public.is_staff(auth.uid()));
create policy "Personal actualiza su perfil"
  on public.staff_profiles for update to authenticated
  using (auth.uid() = user_id and public.is_staff(auth.uid()))
  with check (auth.uid() = user_id and public.is_staff(auth.uid()));

create trigger t_staff_profiles_updated
  before update on public.staff_profiles
  for each row execute function public.touch_updated_at();
