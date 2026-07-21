// ============================================================
// _shared/audit.ts — Immutable audit + activity + webhook logging.
// ============================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export type AuditEvent =
  | "PARTICIPANT_REGISTERED"
  | "PAYMENT_AUTHORIZED"
  | "PAYMENT_CAPTURED"
  | "PAYMENT_FAILED"
  | "PAYMENT_REFUNDED"
  | "TICKET_ASSIGNED"
  | "LOTTERY_CREATED"
  | "LOTTERY_EDITED"
  | "LOTTERY_PAUSED"
  | "LOTTERY_CLOSED"
  | "DRAWING_EXECUTED"
  | "ADMIN_LOGIN"
  | "ADMIN_ROLE_CHANGED"
  | "VOICE_PROMPT_UPDATED"
  | "SETTINGS_CHANGED";

interface AuditParams {
  event: AuditEvent;
  actorId?: string | null;
  actorType?: "admin" | "system" | "voice" | "web";
  lotteryId?: string | null;
  entityType?: string;
  entityId?: string | null;
  data?: Record<string, unknown>;
  ipAddress?: string | null;
}

export async function writeAudit(client: SupabaseClient, params: AuditParams): Promise<void> {
  await client.from("audit_logs").insert({
    event: params.event,
    actor_id: params.actorId ?? null,
    actor_type: params.actorType ?? "system",
    lottery_id: params.lotteryId ?? null,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    data: params.data ?? {},
    ip_address: params.ipAddress ?? null,
  });
}

export async function logWebhook(
  client: SupabaseClient,
  source: "sola" | "signalwire",
  payload: unknown,
  opts: { eventType?: string; signatureValid?: boolean; processed?: boolean; error?: string } = {},
): Promise<string | null> {
  const { data } = await client
    .from("webhook_logs")
    .insert({
      source,
      event_type: opts.eventType ?? null,
      signature_valid: opts.signatureValid ?? null,
      payload,
      processed: opts.processed ?? false,
      error_message: opts.error ?? null,
    })
    .select("id")
    .single();
  return data?.id ?? null;
}
