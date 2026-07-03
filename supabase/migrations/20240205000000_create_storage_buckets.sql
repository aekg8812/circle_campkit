-- ============================================================
-- Supabase Storage buckets for images
-- ============================================================

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('gear', 'gear', true),
  ('group-images', 'group-images', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "storage: public read campkit images" on storage.objects;
drop policy if exists "storage: authenticated insert campkit images" on storage.objects;
drop policy if exists "storage: authenticated update campkit images" on storage.objects;
drop policy if exists "storage: authenticated delete campkit images" on storage.objects;

create policy "storage: public read campkit images"
  on storage.objects for select
  using (bucket_id in ('avatars', 'gear', 'group-images'));

create policy "storage: authenticated insert campkit images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id in ('avatars', 'gear', 'group-images'));

create policy "storage: authenticated update campkit images"
  on storage.objects for update
  to authenticated
  using (bucket_id in ('avatars', 'gear', 'group-images'))
  with check (bucket_id in ('avatars', 'gear', 'group-images'));

create policy "storage: authenticated delete campkit images"
  on storage.objects for delete
  to authenticated
  using (bucket_id in ('avatars', 'gear', 'group-images'));
