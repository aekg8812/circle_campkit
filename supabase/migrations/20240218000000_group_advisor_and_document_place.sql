-- ============================================================
-- 顧問教員をグループに持たせ、計画書に「場所」の欄を足す
--
-- 1. 顧問教員（氏名・所属等・TEL）
--    これまでは計画書ごとに入力していたが、サークルの顧問は滅多に変わらない。
--    毎回入れ直すのは手間なので、グループに1つ持たせて自動で入るようにする。
--    グループは既存の UPDATE ポリシー（メンバーなら編集可）が効くので、
--    ポリシーの追加は不要。
--
-- 2. 計画書の「場所」
--    これまでは計画の area をそのまま出すだけで、計画書の画面に入力欄が無く、
--    未入力だと空欄のまま直せなかった。計画書側にも欄を持たせ、
--    入っていればそちらを優先する（提出用に詳しく書きたい場合にも対応）。
--
-- 既存データには影響しない（どちらも null で始まり、null なら今までと同じ動き）。
-- ============================================================

alter table groups
  add column if not exists advisor_name text,
  add column if not exists advisor_affiliation text,
  add column if not exists advisor_phone text;

comment on column groups.advisor_name is '顧問教員の氏名。計画書に自動で入る';
comment on column groups.advisor_affiliation is '顧問教員の所属等。計画書に自動で入る';
comment on column groups.advisor_phone is '顧問教員のTEL。計画書に自動で入る';

alter table plan_documents
  add column if not exists place text;

comment on column plan_documents.place is
  '計画書に出す場所。未入力なら plans.area を使う';
