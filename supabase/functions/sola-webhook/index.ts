// ============================================================
// sola-webhook — receives Sola Payments webhooks (WEB flow finalize).
//   * Verifies HMAC signature (rejects unsigned/invalid).
//   * On authorization success: assigns ticket, captures exact
//     ticket amount, sends SMS + email — all via finalizeEntry.
//   * Logs every raw payload to webhook_logs.
// ============================================================

import { handlePreflight, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { getPaymentGateway } from "../_shared/payment/factory.ts";
import { finalizeEntry, EntryError } from "../_shared/entry-service.ts";
import { logWebhook } from "../_shared/audit.ts";
import type { Lottery } from "../_shared/types.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", "POST only", 405);

  const client = getAdminClient();
  const gateway = getPaymentGateway();
  const rawBody = await req.text();
  const signature = req.headers.get("x-sola-signature");

  const valid = await gateway.verifyWebhookSignature(rawBody, signature);
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    await logWebhook(client, "sola", { raw: rawBody }, { signatureValid: valid, error: "bad_json" });
    return errorResponse("BAD_PAYLOAD", "Invalid JSON", 400);
  }

  const eventType = (payload.type as string) ?? (payload.event as string) ?? "unknown";
  const webhookId = await logWebhook(client, "sola", payload, {
    eventType,
    signatureValid: valid,
  });

  if (!valid) {
    return errorResponse("INVALID_SIGNATURE", "Webhook signature verification failed", 401);
  }

  // We only act on a successful authorization for a hosted checkout session.
  if (eventType !== "authorization.succeeded" && eventType !== "payment.authorized") {
    await client.from("webhook_logs").update({ processed: true }).eq("id", webhookId);
    return jsonResponse({ received: true, ignored: eventType });
  }

  const data = (payload.data ?? payload) as Record<string, unknown>;
  const sessionId = String(data.session_id ?? "");
  const authId = String(data.auth_id ?? data.authorization_id ?? "");
  const authorizedCents = Number(data.authorized_amount ?? data.amount ?? 0);
  const metadata = (data.metadata ?? {}) as Record<string, string>;
  const lotteryId = metadata.lottery_id;

  if (!sessionId || !authId || !lotteryId) {
    await client.from("webhook_logs").update({ processed: true, error_message: "missing_fields" })
      .eq("id", webhookId);
    return errorResponse("MISSING_FIELDS", "session_id/auth_id/lottery_id required", 400);
  }

  // Idempotency: skip if this session already produced a captured payment.
  const { data: existing } = await client
    .from("payments")
    .select("id, status, participant_id")
    .eq("session_id", sessionId)
    .in("status", ["captured"])
    .maybeSingle();
  if (existing) {
    await client.from("webhook_logs").update({ processed: true }).eq("id", webhookId);
    return jsonResponse({ received: true, alreadyProcessed: true });
  }

  const { data: lottery } = await client
    .from("lotteries").select("*").eq("id", lotteryId).single<Lottery>();
  if (!lottery) return errorResponse("LOTTERY_NOT_FOUND", "Lottery not found", 404);

  try {
    const result = await finalizeEntry(client, gateway, {
      lottery,
      authId,
      authorizedCents,
      sessionId,
      channel: "web",
      firstName: metadata.first_name ?? "",
      lastName: metadata.last_name ?? "",
      phone: metadata.phone ?? "",
      email: metadata.email || null,
      address: metadata.address || null,
      gatewayRawAuth: data,
    });

    await client.from("webhook_logs").update({ processed: true }).eq("id", webhookId);
    return jsonResponse({ received: true, ticketNumber: result.ticketNumber });
  } catch (err) {
    const code = err instanceof EntryError ? err.code : "FINALIZE_FAILED";
    await client.from("webhook_logs")
      .update({ processed: true, error_message: (err as Error).message })
      .eq("id", webhookId);
    // Return 200 so Sola does not infinitely retry an unrecoverable case
    // (auth already voided inside finalizeEntry). Non-recoverable => acknowledge.
    return jsonResponse({ received: true, error: code }, 200);
  }
});
