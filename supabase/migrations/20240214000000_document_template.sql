-- 計画書の様式をグループごとに変えられるようにする。
--
-- これまで様式はコードに固定で書かれており、項目の増減ができなかった。
-- 大学・学部によって必要な欄が違うため、行の定義をグループが持てるようにする。
--
-- document_template が null のグループは、これまでと同じ標準様式で描かれる。
-- 既存の計画書には影響しない。

alter table groups
  add column if not exists document_template jsonb;

alter table plan_documents
  add column if not exists custom_values jsonb;

comment on column groups.document_template is
  '計画書の様式。{"rows":[{"key","label","source"}]} の形。null なら標準様式';

comment on column plan_documents.custom_values is
  '様式に追加した項目に入力された値。{"custom_xxx":"..."} の形';
