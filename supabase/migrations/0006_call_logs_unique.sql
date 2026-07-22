-- ============================================================
-- 0006_call_logs_unique.sql
-- Unique constraint on call_logs.call_sid so the SignalWire voice
-- flow can upsert the per-call row (onConflict = call_sid). Without
-- this, the upsert failed silently and the card/exp stash never
-- persisted across IVR steps.
-- ============================================================

alter table public.call_logs
  add constraint uq_call_logs_call_sid unique (call_sid);
