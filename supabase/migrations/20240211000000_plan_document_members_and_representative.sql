-- ============================================================
-- 計画書(plan_documents)
--   1) グループのメンバーなら誰でも編集できるようにする
--      （これまでは起案者のみ。顧問教員・宿泊所・病院などを分担して入力できる）
--   2) 代表者をフォームで選べるようにするためのカラムを追加
--      （部長を複数人に設定できるため、誰を代表者にするか明示できるようにする）
-- ============================================================

-- 1) メンバーによる作成・更新を許可
drop policy if exists "plan_documents: グループメンバーは作成可" on plan_documents;
drop policy if exists "plan_documents: グループメンバーは更新可" on plan_documents;

create policy "plan_documents: グループメンバーは作成可"
  on plan_documents for insert
  with check (is_plan_group_member(plan_id));

create policy "plan_documents: グループメンバーは更新可"
  on plan_documents for update
  using (is_plan_group_member(plan_id))
  with check (is_plan_group_member(plan_id));

-- 2) 代表者（誰を計画書の代表者として載せるか）
alter table plan_documents
  add column if not exists representative_user_id uuid references profiles(id);
