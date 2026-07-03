-- ============================================================
-- Plan default transport and schedule item transport override
-- ============================================================

alter table plans
  add column if not exists default_transport text;

alter table schedule_items
  add column if not exists transport text;
