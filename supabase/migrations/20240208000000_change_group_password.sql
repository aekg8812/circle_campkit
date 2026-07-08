-- ============================================================
-- グループの参加パスワードを変更する RPC（部長のみ）
--   group_secrets は全クライアント直接アクセス不可なので、
--   SECURITY DEFINER 関数からのみ更新する。
-- ============================================================

create or replace function public.change_group_password(
  p_group_id uuid,
  p_new_password text
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

  -- 部長のみ変更可
  if not exists (
    select 1 from group_members
    where group_id = p_group_id
      and user_id = auth.uid()
      and position = '部長'
  ) then
    raise exception '権限がありません（部長のみパスワードを変更できます）';
  end if;

  if length(coalesce(p_new_password, '')) < 1 then
    raise exception 'パスワードを入力してください';
  end if;

  update group_secrets
  set password_hash = crypt(p_new_password, gen_salt('bf'))
  where group_id = p_group_id;
end;
$$;
