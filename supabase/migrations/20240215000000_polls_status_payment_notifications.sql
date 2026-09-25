-- 他サービス比較で見つかった4つの穴をふさぐための変更。
--   1. 締切リマインド通知（送信ログ）
--   2. 日程調整（候補日への投票）
--   3. 出欠の「未定」
--   4. 集金の管理
--
-- 既存のテーブルへの追加は列2つだけで、既存データには影響しない。

-- ============================================================
-- 3. 出欠の「未定」/ 4. 集金
-- ============================================================
-- going  = 参加する
-- maybe  = 未定（行けるか分からない）
alter table participants
  add column if not exists status text not null default 'going';

-- 集金が済んだ日時。null なら未払い
alter table participants
  add column if not exists paid_at timestamptz;

comment on column participants.status is '参加の状態。going=参加 / maybe=未定';
comment on column participants.paid_at is '集金が済んだ日時。null は未払い';

-- ============================================================
-- 2. 日程調整
-- ============================================================
create table if not exists date_polls (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  created_by uuid references profiles(id),
  title text not null,
  -- open = 回答受付中 / closed = 締め切り済み
  status text not null default 'open',
  created_at timestamptz default now()
);

create table if not exists date_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid references date_polls(id) on delete cascade,
  day date not null,
  sort_order int default 0,
  unique (poll_id, day)
);

create table if not exists date_poll_votes (
  id uuid primary key default gen_random_uuid(),
  option_id uuid references date_poll_options(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  -- yes = ○ / maybe = △ / no = ×
  answer text not null,
  unique (option_id, user_id)
);

alter table date_polls enable row level security;
alter table date_poll_options enable row level security;
alter table date_poll_votes enable row level security;

-- 日程調整はグループのメンバーなら誰でも見られる
create policy "date_polls: メンバーは閲覧可"
  on date_polls for select
  using (is_group_member(group_id));

create policy "date_polls: メンバーは作成可"
  on date_polls for insert
  with check (is_group_member(group_id) and created_by = auth.uid());

-- 締め切りや削除は作成者のみ
create policy "date_polls: 作成者は更新可"
  on date_polls for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "date_polls: 作成者は削除可"
  on date_polls for delete
  using (created_by = auth.uid());

create policy "date_poll_options: メンバーは閲覧可"
  on date_poll_options for select
  using (
    exists (
      select 1 from date_polls p
      where p.id = date_poll_options.poll_id and is_group_member(p.group_id)
    )
  );

create policy "date_poll_options: 作成者は全操作可"
  on date_poll_options for all
  using (
    exists (
      select 1 from date_polls p
      where p.id = date_poll_options.poll_id and p.created_by = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from date_polls p
      where p.id = date_poll_options.poll_id and p.created_by = auth.uid()
    )
  );

create policy "date_poll_votes: メンバーは閲覧可"
  on date_poll_votes for select
  using (
    exists (
      select 1 from date_poll_options o
      join date_polls p on p.id = o.poll_id
      where o.id = date_poll_votes.option_id and is_group_member(p.group_id)
    )
  );

-- 投票は本人の分だけ
create policy "date_poll_votes: 本人は登録可"
  on date_poll_votes for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from date_poll_options o
      join date_polls p on p.id = o.poll_id
      where o.id = date_poll_votes.option_id and is_group_member(p.group_id)
    )
  );

create policy "date_poll_votes: 本人は更新可"
  on date_poll_votes for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "date_poll_votes: 本人は削除可"
  on date_poll_votes for delete
  using (user_id = auth.uid());

-- ============================================================
-- 1. 通知の送信ログ（同じ通知を二重に送らないため）
-- ============================================================
create table if not exists notification_logs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade,
  -- deadline_reminder = 募集締切の前日リマインド
  kind text not null,
  sent_at timestamptz default now(),
  unique (plan_id, kind)
);

alter table notification_logs enable row level security;
-- 書き込むのはサーバー（サービスロール）だけ。
-- permissive なポリシーを置かない＝一般ユーザーからは読み書きできない。
