-- ============================================================
-- Phase 6: 活動後のレビュー(plan_reviews)
--   1計画につき1ユーザー1件にするため unique 制約を追加。
--   これにより upsert(onConflict: plan_id,user_id) で
--   「自分のレビューを保存し直す」操作ができる。
-- ============================================================

-- 念のため重複行があれば新しい1件を残して掃除してから制約を張る
delete from plan_reviews a
using plan_reviews b
where a.plan_id = b.plan_id
  and a.user_id = b.user_id
  and a.created_at < b.created_at;

alter table plan_reviews
  add constraint plan_reviews_plan_user_unique unique (plan_id, user_id);
