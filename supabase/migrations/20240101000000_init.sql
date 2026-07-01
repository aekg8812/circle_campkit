-- ============================================================
-- CampKit 初期マイグレーション
-- Phase 0: 全テーブル定義 + RLS + Trigger
-- ============================================================

-- --------------------------------------------------------
-- A. プロフィール（auth.users を拡張）
-- --------------------------------------------------------
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  grade int,
  department text,
  student_id text,
  school_email text,
  phone text,
  academic_advisor text,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- A. 車の登録
create table cars (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade,
  name text,
  capacity int,
  luggage_capacity text,
  created_at timestamptz default now()
);

-- A. キャンプ道具の登録
create table gear (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id) on delete cascade,
  name text not null,
  price int,
  category text,
  quantity int,
  capacity int,
  photo_url text,
  created_at timestamptz default now()
);

-- グループ（＝サークル）
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- グループメンバー
create table group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  position text default '部員',
  joined_at timestamptz default now(),
  unique (group_id, user_id)
);

-- 計画
create table plans (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id) on delete cascade,
  creator_id uuid references profiles(id),
  title text not null,
  category text,
  status text default 'draft',
  start_date date,
  end_date date,
  area text,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- B. 行程表の各行
create table schedule_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade,
  day date,
  time time,
  sort_order int default 0,
  time_label text,
  location_name text,
  location_type text,
  map_query text,
  created_at timestamptz default now()
);

-- B. 注釈
create table plan_notes (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade,
  note_type text,
  body text
);

-- B. 交通手段
create table transports (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade,
  type text,
  note text
);

-- B. 車の割り当て
create table transport_cars (
  id uuid primary key default gen_random_uuid(),
  transport_id uuid references transports(id) on delete cascade,
  car_id uuid references cars(id),
  note text
);

-- C. 募集
create table recruitments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade unique,
  type text,
  capacity int,
  deadline timestamptz,
  is_closed boolean default false
);

-- C. 参加者
create table participants (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  joined_at timestamptz default now(),
  unique (plan_id, user_id)
);

-- D. 計画書
create table plan_documents (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade unique,
  created_date date,
  advisor_name text,
  advisor_affiliation text,
  advisor_phone text,
  lodging_name text,
  lodging_address text,
  lodging_phone text,
  hospital_name text,
  hospital_address text,
  hospital_phone text,
  hospital_distance text,
  notes text,
  created_at timestamptz default now()
);

-- E. 準備
create table preparations (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade,
  user_id uuid references profiles(id),
  type text,
  body text,
  created_at timestamptz default now()
);

-- F. アーカイブのコメント
create table plan_reviews (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references plans(id) on delete cascade,
  user_id uuid references profiles(id),
  body text,
  cost_per_person int,
  created_at timestamptz default now()
);

-- ============================================================
-- Trigger: 新規ユーザー登録時に profiles 行を自動作成
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- RLS 有効化
-- ============================================================
alter table profiles enable row level security;
alter table cars enable row level security;
alter table gear enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table plans enable row level security;
alter table schedule_items enable row level security;
alter table plan_notes enable row level security;
alter table transports enable row level security;
alter table transport_cars enable row level security;
alter table recruitments enable row level security;
alter table participants enable row level security;
alter table plan_documents enable row level security;
alter table preparations enable row level security;
alter table plan_reviews enable row level security;

-- ============================================================
-- RLS ヘルパー関数
-- ============================================================

-- 指定グループのメンバーかどうかを返す
create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
security definer stable
as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

-- 指定計画の親グループのメンバーかどうかを返す
create or replace function public.is_plan_group_member(pid uuid)
returns boolean
language sql
security definer stable
as $$
  select exists (
    select 1 from plans p
    join group_members gm on gm.group_id = p.group_id
    where p.id = pid and gm.user_id = auth.uid()
  );
$$;

-- 指定計画の起案者かどうかを返す
create or replace function public.is_plan_creator(pid uuid)
returns boolean
language sql
security definer stable
as $$
  select exists (
    select 1 from plans
    where id = pid and creator_id = auth.uid()
  );
$$;

-- ============================================================
-- RLS ポリシー: profiles
-- ============================================================
create policy "profiles: 本人は全操作可"
  on profiles for all
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles: 同グループメンバーは閲覧可"
  on profiles for select
  using (
    exists (
      select 1 from group_members gm1
      join group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = profiles.id and gm2.user_id = auth.uid()
    )
  );

-- ============================================================
-- RLS ポリシー: cars
-- ============================================================
create policy "cars: 所有者は全操作可"
  on cars for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "cars: 同グループメンバーは閲覧可"
  on cars for select
  using (
    exists (
      select 1 from group_members gm1
      join group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = cars.owner_id and gm2.user_id = auth.uid()
    )
  );

-- ============================================================
-- RLS ポリシー: gear
-- ============================================================
create policy "gear: 所有者は全操作可"
  on gear for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "gear: 同グループメンバーは閲覧可"
  on gear for select
  using (
    exists (
      select 1 from group_members gm1
      join group_members gm2 on gm1.group_id = gm2.group_id
      where gm1.user_id = gear.owner_id and gm2.user_id = auth.uid()
    )
  );

-- ============================================================
-- RLS ポリシー: groups
-- ============================================================
create policy "groups: 認証ユーザーは作成可"
  on groups for insert
  with check (auth.uid() is not null);

create policy "groups: メンバーは閲覧可"
  on groups for select
  using (is_group_member(id));

-- ============================================================
-- RLS ポリシー: group_members
-- ============================================================
create policy "group_members: 同グループメンバーは閲覧可"
  on group_members for select
  using (is_group_member(group_id));

create policy "group_members: 本人のみ参加（insert）可"
  on group_members for insert
  with check (user_id = auth.uid());

create policy "group_members: 本人のみ脱退（delete）可"
  on group_members for delete
  using (user_id = auth.uid());

-- ============================================================
-- RLS ポリシー: plans
-- ============================================================
create policy "plans: 起案者は全操作可"
  on plans for all
  using (creator_id = auth.uid())
  with check (creator_id = auth.uid());

create policy "plans: グループメンバーはdraft以外を閲覧可"
  on plans for select
  using (
    status <> 'draft' and is_group_member(group_id)
  );

create policy "plans: グループメンバーは新規作成可"
  on plans for insert
  with check (is_group_member(group_id) and creator_id = auth.uid());

-- ============================================================
-- RLS ポリシー: schedule_items
-- ============================================================
create policy "schedule_items: 起案者は全操作可"
  on schedule_items for all
  using (is_plan_creator(plan_id))
  with check (is_plan_creator(plan_id));

create policy "schedule_items: グループメンバーはdraft以外を閲覧可"
  on schedule_items for select
  using (
    exists (
      select 1 from plans p
      where p.id = schedule_items.plan_id and p.status <> 'draft'
        and is_group_member(p.group_id)
    )
  );

-- ============================================================
-- RLS ポリシー: plan_notes
-- ============================================================
create policy "plan_notes: 起案者は全操作可"
  on plan_notes for all
  using (is_plan_creator(plan_id))
  with check (is_plan_creator(plan_id));

create policy "plan_notes: グループメンバーはdraft以外を閲覧可"
  on plan_notes for select
  using (
    exists (
      select 1 from plans p
      where p.id = plan_notes.plan_id and p.status <> 'draft'
        and is_group_member(p.group_id)
    )
  );

-- ============================================================
-- RLS ポリシー: transports
-- ============================================================
create policy "transports: 起案者は全操作可"
  on transports for all
  using (is_plan_creator(plan_id))
  with check (is_plan_creator(plan_id));

create policy "transports: グループメンバーはdraft以外を閲覧可"
  on transports for select
  using (
    exists (
      select 1 from plans p
      where p.id = transports.plan_id and p.status <> 'draft'
        and is_group_member(p.group_id)
    )
  );

-- ============================================================
-- RLS ポリシー: transport_cars
-- ============================================================
create policy "transport_cars: 起案者は全操作可"
  on transport_cars for all
  using (
    exists (
      select 1 from transports t
      where t.id = transport_cars.transport_id and is_plan_creator(t.plan_id)
    )
  )
  with check (
    exists (
      select 1 from transports t
      where t.id = transport_cars.transport_id and is_plan_creator(t.plan_id)
    )
  );

create policy "transport_cars: グループメンバーはdraft以外を閲覧可"
  on transport_cars for select
  using (
    exists (
      select 1 from transports t
      join plans p on p.id = t.plan_id
      where t.id = transport_cars.transport_id
        and p.status <> 'draft'
        and is_group_member(p.group_id)
    )
  );

-- ============================================================
-- RLS ポリシー: recruitments
-- ============================================================
create policy "recruitments: 起案者は全操作可"
  on recruitments for all
  using (is_plan_creator(plan_id))
  with check (is_plan_creator(plan_id));

create policy "recruitments: グループメンバーはdraft以外を閲覧可"
  on recruitments for select
  using (
    exists (
      select 1 from plans p
      where p.id = recruitments.plan_id and p.status <> 'draft'
        and is_group_member(p.group_id)
    )
  );

-- ============================================================
-- RLS ポリシー: participants
-- ============================================================
create policy "participants: グループメンバーは閲覧可"
  on participants for select
  using (is_plan_group_member(plan_id));

create policy "participants: 本人は参加・脱退可"
  on participants for insert
  with check (user_id = auth.uid() and is_plan_group_member(plan_id));

create policy "participants: 本人は削除可"
  on participants for delete
  using (user_id = auth.uid());

-- ============================================================
-- RLS ポリシー: plan_documents
-- ============================================================
create policy "plan_documents: 起案者は全操作可"
  on plan_documents for all
  using (is_plan_creator(plan_id))
  with check (is_plan_creator(plan_id));

create policy "plan_documents: グループメンバーはdraft以外を閲覧可"
  on plan_documents for select
  using (
    exists (
      select 1 from plans p
      where p.id = plan_documents.plan_id and p.status <> 'draft'
        and is_group_member(p.group_id)
    )
  );

-- ============================================================
-- RLS ポリシー: preparations
-- ============================================================
create policy "preparations: 本人は書き込み可"
  on preparations for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "preparations: グループメンバーは閲覧可"
  on preparations for select
  using (is_plan_group_member(plan_id));

-- ============================================================
-- RLS ポリシー: plan_reviews
-- ============================================================
create policy "plan_reviews: 本人は書き込み可"
  on plan_reviews for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "plan_reviews: グループメンバーは閲覧可"
  on plan_reviews for select
  using (is_plan_group_member(plan_id));
