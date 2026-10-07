-- ============================================================
-- 学校提出用の計画書が新しい様式（R8.10.02〜）に変わったことへの対応
--
-- 1. 参加者ごとに「車を出せるか」を持たせる（participants.brings_car）
--    新様式の「入構車両」の台数を、参加者の回答から数えるため。
--    計画書は募集締切の直後に出す必要があるので、参加するときに必ず答えてもらう。
--    null = 未回答（この変更より前に参加した人）/ true = 出せる / false = 出せない
--
-- 2. 計画書の新しい欄（plan_documents）
--    - 表題「○○利用許可願・○○企画」のどちら（または両方）にするか
--    - 来校予定の学外者の人数
--    - 学生係へ提出した日時（提出期限の催促を止めるため）
--
-- 既存データには影響しない（追加のみ。既定値は今までの計画書と同じ「企画」）。
-- RLS は既存のポリシー（participants は本人・起案者が更新可、
-- plan_documents はグループのメンバーが更新可）がそのまま効くので追加しない。
-- ============================================================

alter table participants
  add column if not exists brings_car boolean;

comment on column participants.brings_car is
  '車を出せるか。null=未回答 / true=出せる / false=出せない。計画書の「入構車両」の台数に使う';

alter table plan_documents
  add column if not exists apply_facility boolean not null default false,
  add column if not exists facility_name text,
  add column if not exists apply_event boolean not null default true,
  add column if not exists event_name text,
  add column if not exists outside_visitor_count int not null default 0,
  add column if not exists submitted_at timestamptz;

comment on column plan_documents.apply_facility is '表題に「○○利用許可願」を出すか';
comment on column plan_documents.facility_name is '利用許可を願う施設（例: 講義室）';
comment on column plan_documents.apply_event is '表題に「○○企画」を出すか';
comment on column plan_documents.event_name is '企画の名前。未入力なら計画の行事名を使う';
comment on column plan_documents.outside_visitor_count is '来校予定の学外者の人数。0 なら「無」';
comment on column plan_documents.submitted_at is '学生係へ提出した日時。null は未提出（提出期限の催促を出す）';
