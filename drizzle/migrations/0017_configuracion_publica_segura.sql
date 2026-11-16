drop policy if exists "Configuración pública" on public.business_settings;
drop policy if exists "Admin ve configuración" on public.business_settings;
create policy "Admin ve configuración"
  on public.business_settings
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

revoke select on public.business_settings from anon;
grant select on public.business_settings to authenticated;

create or replace function public.get_public_business_settings()
returns table(
  name text,
  whatsapp text,
  instagram text,
  tiktok text,
  address text,
  hours text
)
language sql
stable
security definer
set search_path to 'public'
as $f$
  select s.name, s.whatsapp, s.instagram, s.tiktok, s.address, s.hours
  from public.business_settings s
  where s.id = 1
$f$;

revoke all on function public.get_public_business_settings() from public;
grant execute on function public.get_public_business_settings() to anon, authenticated;
