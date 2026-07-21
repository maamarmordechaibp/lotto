// ============================================================
// _shared/entry-service.ts
// Shared entry finalization used by BOTH phone and web channels.
//
// Guarantees (per spec):
//   * No ticket is assigned without a successful payment capture.
//   * No payment is captured without a confirmed ticket assignment.
//   * Ticket assignment + payment recording happen atomically in a
//     SERIALIZABLE DB transaction (via assign_ticket_and_record_payment).
//   * If ticket assignment fails, the authorization is VOIDED.
// ============================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import type { PaymentGateway } from "./payment/gateway.ts";
import type { EntryChannel, Lottery } from "./types.ts";
import { writeAudit } from "./audit.ts";
import {
  type NotificationContext,
  sendConfirmationEmail,
  sendConfirmationSms,
} from "./notifications.ts";
import { env } from "./env.ts";

export interface FinalizeParams {
  lottery: Lottery;
  authId: string;
  authorizedCents: number;
  sessionId: string;
  channel: EntryChannel;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  ipAddress?: string | null;
  gatewayRawAuth?: unknown;
}

export interface FinalizeResult {
  participantId: string;
  ticketNumber: number;
  amountDollars: number;
  paymentId: string;
  receiptPath: string | null;
}

/**
 * Assign a ticket, capture the exact ticket amount, and notify the entrant.
 * Voids the authorization if no ticket can be assigned.
 */
export async function finalizeEntry(
  client: SupabaseClient,
  gateway: PaymentGateway,
  params: FinalizeParams,
): Promise<FinalizeResult> {
  const { lottery } = params;

  // 1. Atomically reserve an unused ticket + create participant/payment rows.
  //    The RPC runs the SERIALIZABLE assignment transaction server-side.
  const { data: assigned, error: assignErr } = await client.rpc(
    "assign_ticket_and_record_payment",
    {
      p_lottery_id: lottery.id,
      p_first_name: params.firstName,
      p_last_name: params.lastName,
      p_phone: params.phone,
      p_email: params.email ?? null,
      p_address: params.address ?? null,
      p_channel: params.channel,
      p_gateway: gateway.name,
      p_gateway_reference: params.authId,
      p_auth_id: params.authId,
      p_session_id: params.sessionId,
      p_authorized_cents: params.authorizedCents,
      p_raw_response: params.gatewayRawAuth ?? {},
    },
  ).single();

  // 2. If assignment failed (sold out / not open), VOID the authorization.
  if (assignErr || !assigned) {
    await gateway.voidPayment(params.authId).catch(() => {});
    await writeAudit(client, {
      event: "PAYMENT_FAILED",
      actorType: params.channel,
      lotteryId: lottery.id,
      data: { reason: assignErr?.message ?? "assignment_failed", authId: params.authId },
      ipAddress: params.ipAddress ?? null,
    });
    throw new EntryError(
      mapAssignError(assignErr?.message),
      assignErr?.message ?? "Ticket assignment failed",
    );
  }

  const record = assigned as {
    participant_id: string;
    ticket_number: number;
    amount_cents: number;
    payment_id: string;
  };
  const ticketAmountCents = record.amount_cents;

  // 3. Capture EXACTLY the ticket amount (not the authorized maximum).
  try {
    const capture = await gateway.capturePayment(params.authId, ticketAmountCents);
    if (capture.status !== "captured") throw new Error("capture_declined");

    await client
      .from("payments")
      .update({
        status: "captured",
        gateway_reference: capture.transactionId,
        amount_cents: capture.capturedCents,
        raw_response: capture.raw as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq("id", record.payment_id);
  } catch (captureErr) {
    // Capture failed AFTER assignment: void auth, roll participant back.
    await gateway.voidPayment(params.authId).catch(() => {});
    await client.from("participants").update({ payment_status: "failed" })
      .eq("id", record.participant_id);
    await client.from("payments").update({
      status: "failed",
      error_message: captureErr instanceof Error ? captureErr.message : String(captureErr),
    }).eq("id", record.payment_id);
    await writeAudit(client, {
      event: "PAYMENT_FAILED",
      actorType: params.channel,
      lotteryId: lottery.id,
      entityId: record.participant_id,
      data: { stage: "capture", authId: params.authId },
    });
    throw new EntryError("CAPTURE_FAILED", "Payment capture failed");
  }

  const amountDollars = record.ticket_number; // ticket number == dollars

  // 4. Audit trail.
  await writeAudit(client, {
    event: "TICKET_ASSIGNED",
    actorType: params.channel,
    lotteryId: lottery.id,
    entityType: "participant",
    entityId: record.participant_id,
    data: { ticketNumber: record.ticket_number, amountCents: ticketAmountCents },
    ipAddress: params.ipAddress ?? null,
  });
  await writeAudit(client, {
    event: "PAYMENT_CAPTURED",
    actorType: params.channel,
    lotteryId: lottery.id,
    entityType: "payment",
    entityId: record.payment_id,
    data: { amountCents: ticketAmountCents, gatewayReference: params.authId },
  });

  // 5. Notifications (SMS + Email). Failures are logged, not fatal.
  const ctx: NotificationContext = {
    firstName: params.firstName,
    lastName: params.lastName,
    lotteryName: lottery.name,
    ticketNumber: record.ticket_number,
    amountDollars,
    prize: lottery.prize_text ?? "",
    drawingDate: lottery.drawing_date
      ? new Date(lottery.drawing_date).toLocaleDateString()
      : "TBD",
    confirmationUrl: `${env.appUrl()}/confirmation?ticket=${record.ticket_number}&lottery=${lottery.id}`,
  };

  await sendConfirmationSms(client, record.participant_id, params.phone, ctx, lottery.sms_template);
  if (params.email) {
    await sendConfirmationEmail(
      client, record.participant_id, params.email, ctx,
      lottery.email_subject, lottery.email_template,
    );
  }

  return {
    participantId: record.participant_id,
    ticketNumber: record.ticket_number,
    amountDollars,
    paymentId: record.payment_id,
    receiptPath: null, // receipt generated asynchronously by generate-receipt fn
  };
}

function mapAssignError(message?: string): string {
  if (!message) return "ASSIGNMENT_FAILED";
  if (message.includes("SOLD_OUT")) return "LOTTERY_SOLD_OUT";
  if (message.includes("NOT_OPEN")) return "LOTTERY_NOT_OPEN";
  if (message.includes("NOT_FOUND")) return "LOTTERY_NOT_FOUND";
  return "ASSIGNMENT_FAILED";
}

export class EntryError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}
