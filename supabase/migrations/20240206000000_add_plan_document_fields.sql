-- ============================================================
-- Phase 5: 計画書(plan_documents) 追加カラム
--   recipient      : 宛先（例: 九州工業大学情報工学研究院長 殿）
--   transport_note : 移動手段の表記（例: 車2台）。未入力なら自動生成
-- ============================================================

alter table plan_documents
  add column if not exists recipient text,
  add column if not exists transport_note text;
