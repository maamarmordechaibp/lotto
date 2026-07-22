// ============================================================
// refund-payment — admin issues a refund via the payment gateway.
// Role-gated (super_admin | lottery_manager). Updates payment
// status + participant and writes an audit entry.
// ============================================================

import { handlePreflight, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getAdminClient, requireRole, HttpError } from "../_shared/supabase.ts";
import { getPaymentGateway } from "../_shared/payment/factory.ts";
import { writeAudit } from "../_shared/audit.ts";
import { z } from "zod";

const Schema = z.object({
  paymentId: z.string().uuid(),
  amountCents: z.number().int().positive().optional(),
});

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", "POST only", 405);

  const authHeader = req.headers.get("Authorization");
  let userId: string;
  try {
    ({ userId } = await requireRole(authHeader, ["super_admin", "lottery_manager"]));
  } catch (err) {
    const e = err as HttpError;
    return errorResponse(e.code ?? "FORBIDDEN", e.message, e.status ?? 403);
  }

  let input: z.infer<typeof Schema>;
  try {
    input = Schema.parse(await req.json());
  } catch (err) {
    return errorResponse("VALIDATION_ERROR", (err as Error).message, 422);
  }

  const client = getAdminClient();
  const { data: payment, error } = await client
    .from("payments").select("*").eq("id", input.paymentId).single();

  if (error || !payment) return errorResponse("PAYMENT_NOT_FOUND", "Payment not found", 404);
  if (payment.status !== "captured" && payment.status !== "partially_refunded") {
    return errorResponse("NOT_REFUNDABLE", `Cannot refund a ${payment.status} payment`, 409);
  }
  if (!payment.gateway_reference) {
    return errorResponse("NO_GATEWAY_REF", "Payment has no gateway reference", 409);
  }

  const amount = input.amountCents ?? (payment.amount_cents - payment.refunded_cents);
  if (amount <= 0 || amount > payment.amount_cents - payment.refunded_cents) {
    return errorResponse("INVALID_AMOUNT", "Refund amount exceeds refundable balance", 422);
  }

  const gateway = getPaymentGateway();
  let refund;
  try {
    refund = await gateway.refund(payment.gateway_reference, amount);
  } catch (err) {
    return errorResponse("REFUND_FAILED", (err as Error).message, 502);
  }
  if (refund.status === "failed") {
    return errorResponse("REFUND_DECLINED", "Gateway declined the refund", 502);
  }

  const newRefunded = payment.refunded_cents + refund.refundedCents;
  const newStatus = newRefunded >= payment.amount_cents ? "refunded" : "partially_refunded";

  await client.from("payments").update({
    status: newStatus,
    refunded_cents: newRefunded,
    raw_response: refund.raw as Record<string, unknown>,
    updated_at: new Date().toISOString(),
  }).eq("id", payment.id);

  if (payment.participant_id) {
    await client.from("participants")
      .update({ payment_status: newStatus }).eq("id", payment.participant_id);
  }

  await writeAudit(client, {
    event: "PAYMENT_REFUNDED",
    actorId: userId,
    actorType: "admin",
    lotteryId: payment.lottery_id,
    entityType: "payment",
    entityId: payment.id,
    data: { refundedCents: refund.refundedCents, status: newStatus },
  });

  return jsonResponse({ status: newStatus, refundedCents: refund.refundedCents });
});
