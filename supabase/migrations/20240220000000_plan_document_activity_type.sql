-- ============================================================
-- 計画書を「出す必要があるか／何を出すか」を確認するための回答
--
-- 学生係の「活動内容ごとの提出書類一覧」では、
--   活動場所（学内／学外）× 活動内容（通常／通常と異なる）
-- の組み合わせで、企画書・参加者名簿・顧問確認メールの要否が決まる。
-- 計画書の画面の最初でこの2つを答えてもらい、計画ごとに保存する。
--
-- null = まだ答えていない（その間は、提出が必要なものとして期限を知らせる）
-- 既存データには影響しない（追加のみ）。RLS は既存のポリシーがそのまま効く。
-- ============================================================

alter table plan_documents
  add column if not exists activity_location text
    check (activity_location in ('on_campus', 'off_campus')),
  add column if not exists activity_kind text
    check (activity_kind in ('regular', 'special'));

comment on column plan_documents.activity_location is
  '活動場所。on_campus=学内 / off_campus=学外 / null=未回答';
comment on column plan_documents.activity_kind is
  '活動内容。regular=通常の活動（キャンプ・練習・大会など） / special=通常と異なる活動（合宿・親睦会・地域イベントなど） / null=未回答';
