-- ============================================================
-- セキュリティ対策: 参加パスワードの変更を「グループ作成者のみ」に限定する
--   これまでは position='部長' で認可していたが、役職は各自が自由に選べる仕様のため、
--   一般メンバーが自分を部長に昇格 → パスワード変更、という権限昇格が可能だった。
--   認可を groups.created_by = auth.uid() に変更して、役職と権限を分離する。
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

  -- グループの作成者のみパスワードを変更できる
  if not exists (
    select 1 from groups
    where id = p_group_id
      and created_by = auth.uid()
  ) then
    raise exception '権限がありません（グループの作成者のみ変更できます）';
  end if;

  if length(coalesce(p_new_password, '')) < 1 then
    raise exception 'パスワードを入力してください';
  end if;

  update group_secrets
  set password_hash = crypt(p_new_password, gen_salt('bf'))
  where group_id = p_group_id;
end;
$$;
