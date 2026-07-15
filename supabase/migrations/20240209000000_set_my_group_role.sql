-- ============================================================
-- 自分のグループ内の役職（部長/副部長/部員）を自分で変更する RPC
--   group_members には UPDATE ポリシーがないため、
--   SECURITY DEFINER 関数から「自分の行の position だけ」更新する。
--   ※ 誰でも自分の役職を選べる仕様。部長が複数人いても不具合は起きない。
-- ============================================================

create or replace function public.set_my_group_role(
  p_group_id uuid,
  p_position text
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

  if p_position not in ('部長', '副部長', '部員') then
    raise exception '役職が正しくありません';
  end if;

  update group_members
  set position = p_position
  where group_id = p_group_id
    and user_id = auth.uid();
end;
$$;
