-- ============================================================
-- 0002_indexes.sql
-- Performance indexes on FKs, timestamps, status, lookups.
-- ============================================================

-- participants
create index idx_participants_lottery       on public.participants (lottery_id);
create index idx_participants_phone         on public.participants (phone);
create index idx_participants_ticket        on public.participants (lottery_id, ticket_number);
create index idx_participants_created_at    on public.participants (created_at desc);
create index idx_participants_payment_status on public.participants (payment_status);
create index idx_participants_channel       on public.participants (channel);
create index idx_participants_email         on public.participants (email);
create index idx_participants_not_deleted   on public.participants (lottery_id) where deleted_at is null;

-- payments
create index idx_payments_lottery           on public.payments (lottery_id);
create index idx_payments_participant        on public.payments (participant_id);
create index idx_payments_status            on public.payments (status);
create index idx_payments_gateway_ref       on public.payments (gateway_reference);
create index idx_payments_created_at        on public.payments (created_at desc);

-- lotteries
create index idx_lotteries_status           on public.lotteries (status);
create index idx_lotteries_created_at       on public.lotteries (created_at desc);
create index idx_lotteries_not_deleted      on public.lotteries (status) where deleted_at is null;

-- drawings
create index idx_drawings_lottery           on public.drawings (lottery_id);

-- call_logs
create index idx_call_logs_lottery          on public.call_logs (lottery_id);
create index idx_call_logs_call_sid         on public.call_logs (call_sid);
create index idx_call_logs_created_at       on public.call_logs (created_at desc);

-- sms/email logs
create index idx_sms_logs_participant       on public.sms_logs (participant_id);
create index idx_email_logs_participant     on public.email_logs (participant_id);

-- audit / activity / webhook
create index idx_audit_logs_event           on public.audit_logs (event);
create index idx_audit_logs_lottery         on public.audit_logs (lottery_id);
create index idx_audit_logs_created_at      on public.audit_logs (created_at desc);
create index idx_activity_logs_admin        on public.activity_logs (admin_id);
create index idx_webhook_logs_source        on public.webhook_logs (source, processed);

-- roles
create index idx_user_roles_user            on public.user_roles (user_id);

-- rate limits
create index idx_rate_limits_lookup         on public.rate_limits (scope, identifier, lottery_id, window_start);
