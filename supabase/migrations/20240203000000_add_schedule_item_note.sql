-- ============================================================
-- Schedule item notes
-- ============================================================

alter table schedule_items
  add column if not exists note text;
