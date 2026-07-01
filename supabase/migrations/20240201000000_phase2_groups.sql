-- ============================================================
-- Phase 2: グループモジュール
-- ============================================================

-- pgcrypto 拡張（パスワードハッシュ化に使用）
create extension if not exists pgcrypto;

-- --------------------------------------------------------
-- group_secrets テーブル
-- RLS enabled + permissive policy なし = デフォルト拒否
-- SECURITY DEFINER RPC からのみ操作可能
-- --------------------------------------------------------
create table if not exists group_secrets (
  group_id uuid primary key references groups(id) on delete cascade,
  password_hash text not null
);

alter table group_secrets enable row level security;

-- --------------------------------------------------------
-- groups RLS 更新
-- 認証ユーザーは全グループを閲覧可（参加前に一覧から選ぶため）
-- --------------------------------------------------------
drop policy if exists "groups: メンバーは閲覧可" on groups;

create policy "groups: 認証ユーザーは全グループを閲覧可"
  on groups for select
  using (auth.uid() is not null);

-- --------------------------------------------------------
-- SECURITY DEFINER 関数: create_group
-- --------------------------------------------------------
create or replace function public.create_group(
  p_name      text,
  p_image_url text,
  p_password  text
)
returns uuid
language plpgsql
security definer
set search_path = public
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

-- --------------------------------------------------------
-- SECURITY DEFINER 関数: join_group
-- --------------------------------------------------------
create or replace function public.join_group(
  p_group_id uuid,
  p_password text
)
returns void
language plpgsql
security definer
set search_path = public
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

-- --------------------------------------------------------
-- SECURITY DEFINER 関数: leave_group
-- --------------------------------------------------------
create or replace function public.leave_group(
  p_group_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception '認証が必要です';
  end if;

  delete from group_members
  where group_id = p_group_id and user_id = auth.uid();
end;
$$;

-- --------------------------------------------------------
-- REST API (PostgREST) から呼び出せるよう authenticated ロールに権限付与
-- --------------------------------------------------------
grant execute on function public.create_group(text, text, text) to authenticated;
grant execute on function public.join_group(uuid, text) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
