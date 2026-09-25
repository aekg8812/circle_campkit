-- 計画テンプレートをグループごとに自作できるようにする。
--
-- これまでテンプレートは lib/planTemplates.ts に固定で書かれており、
-- そのサークルの定番の行き先を足すにはコードを直すしかなかった。
-- よく行く場所は年々変わるので、アプリ内で作れるようにする。
--
-- 組み込みのテンプレートは残したまま、グループのテンプレートを併せて出す。

create table if not exists plan_templates (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  created_by uuid references profiles(id),
  emoji text not null default '🏕️',
  name text not null,
  summary text,
  category text,
  -- 泊数（0=日帰り）
  nights int not null default 1,
  -- 一人あたりの目安予算（円）
  budget int,
  transport text,
  description text,
  -- 行程。[{dayOffset, time, time_label, location_name, note}] の配列
  schedule jsonb not null default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table plan_templates enable row level security;

-- テンプレートはグループの共有物。メンバーなら誰でも見られて、誰でも直せる。
-- （計画書の様式を「メンバーなら誰でも編集可」にしているのと同じ考え方）
create policy "plan_templates: メンバーは閲覧可"
  on plan_templates for select
  using (is_group_member(group_id));

create policy "plan_templates: メンバーは作成可"
  on plan_templates for insert
  with check (is_group_member(group_id) and created_by = auth.uid());

create policy "plan_templates: メンバーは更新可"
  on plan_templates for update
  using (is_group_member(group_id))
  with check (is_group_member(group_id));

create policy "plan_templates: メンバーは削除可"
  on plan_templates for delete
  using (is_group_member(group_id));

comment on table plan_templates is 'グループが自作した計画テンプレート';
comment on column plan_templates.schedule is
  '行程の配列。[{dayOffset:int, time:"HH:MM", time_label:string, location_name:string, note:string}]';
