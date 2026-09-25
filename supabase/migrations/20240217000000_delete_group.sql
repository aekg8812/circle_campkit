-- グループを削除できるようにする。
--
-- これまで groups に delete のポリシーが無く、作ったグループを消せなかった。
-- 誤って作ったグループや、活動が終わったサークルを残し続けることになる。
--
-- ただし影響が大きい（計画・参加者・提出書類・テンプレートがすべて消える）ため、
-- 参加パスワードの変更と同じく「グループの作成者だけ」に限定する。
-- RLS のポリシーではなく SECURITY DEFINER の関数にしているのは、
-- 作成者の判定をサーバー側で確実に行うため。

create or replace function public.delete_group(
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

  if not exists (
    select 1 from groups
    where id = p_group_id
      and created_by = auth.uid()
  ) then
    raise exception '権限がありません（グループの作成者のみ削除できます）';
  end if;

  -- group_members / plans / group_secrets / plan_templates などは
  -- すべて groups への外部キーが on delete cascade なので、まとめて消える
  delete from groups where id = p_group_id;
end;
$$;

grant execute on function public.delete_group(uuid) to authenticated;
