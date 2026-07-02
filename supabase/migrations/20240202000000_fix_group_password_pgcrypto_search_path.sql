-- ============================================================
-- Phase 2 fix: pgcrypto functions for group password RPC
-- ============================================================
-- Supabase may install pgcrypto functions in the extensions schema.
-- The original RPC functions used search_path = public, so crypt() and
-- gen_salt() could not be resolved in some projects.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.create_group(
  p_name      text,
  p_image_url text,
  p_password  text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_group_id uuid;
begin
  if auth.uid() is null then
    raise exception '認証が必要です';
  end if;

  insert into groups (name, image_url, created_by)
  values (p_name, p_image_url, auth.uid())
  returning id into v_group_id;

  insert into group_secrets (group_id, password_hash)
  values (v_group_id, crypt(p_password, gen_salt('bf')));

  insert into group_members (group_id, user_id, position)
  values (v_group_id, auth.uid(), '部長');

  return v_group_id;
end;
$$;

create or replace function public.join_group(
  p_group_id uuid,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
begin
  if auth.uid() is null then
    raise exception '認証が必要です';
  end if;

  select password_hash into v_hash
  from group_secrets
  where group_id = p_group_id;

  if v_hash is null then
    raise exception 'グループが見つかりません';
  end if;

  if crypt(p_password, v_hash) <> v_hash then
    raise exception 'パスワードが正しくありません';
  end if;

  insert into group_members (group_id, user_id, position)
  values (p_group_id, auth.uid(), '部員')
  on conflict (group_id, user_id) do nothing;
end;
$$;

grant execute on function public.create_group(text, text, text) to authenticated;
grant execute on function public.join_group(uuid, text) to authenticated;
