// ============================================================
// _shared/notifications.ts — SMS + Email confirmation dispatch.
// Templates support {{placeholder}} substitution.
// ============================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { sendSms } from "./signalwire/client.ts";
import { env } from "./env.ts";

export interface NotificationContext {
  firstName: string;
  lastName: string;
  lotteryName: string;
  ticketNumber: number;
  amountDollars: number;
  prize: string;
  drawingDate: string;
  confirmationUrl: string;
}

const DEFAULT_SMS = [
  "🎟 Lottery Entry Confirmed!",
  "Lottery: {{lotteryName}}",
  "Ticket Number: {{ticketNumber}}",
  "Amount Charged: ${{amountDollars}}",
  "Prize: {{prize}}",
  "Drawing Date: {{drawingDate}}",
  "Good luck! Questions? Reply HELP.",
].join("\n");

const DEFAULT_EMAIL_SUBJECT = "Your Lottery Ticket #{{ticketNumber}} — {{lotteryName}}";

const DEFAULT_EMAIL_BODY = `Dear {{firstName}},

Your entry has been confirmed.

Lottery:       {{lotteryName}}
Ticket Number: {{ticketNumber}}
Amount Paid:   \${{amountDollars}}
Prize:         {{prize}}
Drawing Date:  {{drawingDate}}

View your confirmation: {{confirmationUrl}}

Thank you for participating!`;

export function renderTemplate(template: string, ctx: NotificationContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    const value = (ctx as unknown as Record<string, unknown>)[key];
    return value === undefined || value === null ? "" : String(value);
  });
}

export async function sendConfirmationSms(
  client: SupabaseClient,
  participantId: string,
  to: string,
  ctx: NotificationContext,
  template?: string | null,
): Promise<void> {
  const body = renderTemplate(template || DEFAULT_SMS, ctx);
  try {
    const { sid } = await sendSms(to, body);
    await client.from("sms_logs").insert({
      participant_id: participantId, to_number: to, body, provider_sid: sid, status: "sent",
    });
  } catch (err) {
    await client.from("sms_logs").insert({
      participant_id: participantId, to_number: to, body, status: "failed",
      error_message: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function sendConfirmationEmail(
  client: SupabaseClient,
  participantId: string,
  to: string,
  ctx: NotificationContext,
  subjectTemplate?: string | null,
  bodyTemplate?: string | null,
): Promise<void> {
  const subject = renderTemplate(subjectTemplate || DEFAULT_EMAIL_SUBJECT, ctx);
  const body = renderTemplate(bodyTemplate || DEFAULT_EMAIL_BODY, ctx);
  try {
    // Generic transactional email provider (e.g. Resend/Postmark-style REST).
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.emailProviderKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: env.emailFrom(), to, subject, text: body }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message ?? `Email failed (${res.status})`);
    await client.from("email_logs").insert({
      participant_id: participantId, to_email: to, subject,
      provider_id: data?.id ?? null, status: "sent",
    });
  } catch (err) {
    await client.from("email_logs").insert({
      participant_id: participantId, to_email: to, subject, status: "failed",
      error_message: err instanceof Error ? err.message : String(err),
    });
  }
}
