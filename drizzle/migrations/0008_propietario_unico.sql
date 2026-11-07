do $$
declare
  v_owner_id uuid;
begin
  select id into v_owner_id
  from auth.users
  where lower(email) = 'mmsena@outlook.es'
    and email_confirmed_at is not null
  limit 1;

  if v_owner_id is null then
    raise exception 'No existe una cuenta confirmada para mmsena@outlook.es. Creala y confirmá el correo antes de aplicar esta migración.';
  end if;

  delete from public.user_roles
  where role = 'admin' and user_id <> v_owner_id;

  delete from public.user_roles
  where user_id = v_owner_id and role <> 'admin';

  insert into public.user_roles (user_id, role)
  values (v_owner_id, 'admin')
  on conflict (user_id, role) do nothing;
end
$$;

create or replace function public.set_user_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path to 'public' as $f$
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'Sin permiso'; end if;
  if p_user_id = auth.uid() then raise exception 'No podés cambiar tu propio rol'; end if;
  if exists (
    select 1 from auth.users
    where id = p_user_id and lower(email) = 'mmsena@outlook.es'
  ) then
    raise exception 'No se puede cambiar el rol de la cuenta dueña';
  end if;
  if p_role not in ('vendedor', 'ninguno') then raise exception 'Solo la cuenta dueña puede ser administradora'; end if;
  delete from public.user_roles where user_id = p_user_id;
  if p_role = 'vendedor' then
    insert into public.user_roles (user_id, role) values (p_user_id, 'vendedor');
  end if;
end $f$;
