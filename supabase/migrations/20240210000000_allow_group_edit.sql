-- ============================================================
-- グループの名前・画像をメンバーが編集できるようにする
--   groups には UPDATE ポリシーが無かったため、メンバーなら更新可にする。
--   （パスワードは group_secrets 側なので、この変更では触れられない）
-- ============================================================

drop policy if exists "groups: メンバーは編集可" on groups;

create policy "groups: メンバーは編集可"
  on groups for update
  using (is_group_member(id))
  with check (is_group_member(id));
