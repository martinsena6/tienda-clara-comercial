create policy "Fotos de productos visibles" on storage.objects for select to anon, authenticated using (bucket_id = 'productos');
create policy "Admin sube fotos" on storage.objects for insert to authenticated with check (bucket_id = 'productos' and public.has_role(auth.uid(), 'admin'));
create policy "Admin cambia fotos" on storage.objects for update to authenticated using (bucket_id = 'productos' and public.has_role(auth.uid(), 'admin'));
create policy "Admin borra fotos" on storage.objects for delete to authenticated using (bucket_id = 'productos' and public.has_role(auth.uid(), 'admin'));