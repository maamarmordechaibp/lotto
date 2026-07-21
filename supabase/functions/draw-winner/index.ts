// ============================================================
// draw-winner — admin selects a winner for a lottery.
// Role-gated (super_admin | lottery_manager). Backend randomly
// selects one SOLD ticket via draw_winner() — never an unsold one.
// Records the drawing, audits, and notifies the winner.
// ============================================================

import { handlePreflight, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getAdminClient, requireRole, HttpError } from "../_shared/supabase.ts";
import { writeAudit } from "../_shared/audit.ts";
import { sendSms } from "../_shared/signalwire/client.ts";
import { z } from "zod";
import type { Lottery, Participant } from "../_shared/types.ts";

const Schema = z.object({ lotteryId: z.string().uuid() });

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

  const { data: drawn, error } = await client
    .rpc("draw_winner", { p_lottery_id: input.lotteryId, p_drawn_by: userId })
    .single<{ drawing_id: string; participant_id: string; ticket_number: number; amount_cents: number }>();

  if (error) {
    const map: Record<string, [string, number]> = {
      DRAWING_ALREADY_EXISTS: ["DRAWING_ALREADY_EXISTS", 409],
      NO_ELIGIBLE_TICKETS: ["NO_ELIGIBLE_TICKETS", 409],
    };
    const key = Object.keys(map).find((k) => error.message.includes(k));
    const [code, status] = key ? map[key] : ["DRAW_FAILED", 500];
    return errorResponse(code, error.message, status);
  }

  const { data: lottery } = await client
    .from("lotteries").select("*").eq("id", input.lotteryId).single<Lottery>();
  const { data: winner } = await client
    .from("participants").select("*").eq("id", drawn!.participant_id).single<Participant>();

  await writeAudit(client, {
    event: "DRAWING_EXECUTED",
    actorId: userId,
    actorType: "admin",
    lotteryId: input.lotteryId,
    entityType: "drawing",
    entityId: drawn!.drawing_id,
    data: { ticketNumber: drawn!.ticket_number, participantId: drawn!.participant_id },
  });

  // Notify the winner via SMS (best-effort).
  if (winner?.phone) {
    const msg = `🏆 Congratulations ${winner.first_name}! Your ticket #${drawn!.ticket_number} ` +
      `won ${lottery?.name}. We'll be in touch about your prize: ${lottery?.prize_text ?? ""}.`;
    try {
      const { sid } = await sendSms(winner.phone, msg);
      await client.from("sms_logs").insert({
        participant_id: winner.id, to_number: winner.phone, body: msg,
        provider_sid: sid, status: "sent",
      });
    } catch (err) {
      await client.from("sms_logs").insert({
        participant_id: winner.id, to_number: winner.phone, body: msg,
        status: "failed", error_message: (err as Error).message,
      });
    }
  }

  return jsonResponse({
    drawingId: drawn!.drawing_id,
    ticketNumber: drawn!.ticket_number,
    amountDollars: drawn!.ticket_number,
    winner: winner
      ? { firstName: winner.first_name, lastName: winner.last_name, phone: winner.phone }
      : null,
  });
});
