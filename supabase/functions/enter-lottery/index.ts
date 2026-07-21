// ============================================================
// enter-lottery — WEB entry flow (Step 1).
// Creates a Sola hosted checkout session and returns its URL.
// The frontend redirects the user there (keeping the site out of
// PCI scope). Ticket assignment + capture happen later in the
// sola-webhook function on payment success.
//
// This is the SAME backend API the phone flow builds upon; no
// ticket numbers or payments are ever computed on the frontend.
// ============================================================

import { handlePreflight, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { getPaymentGateway } from "../_shared/payment/factory.ts";
import { checkRateLimit, isDuplicatePhone } from "../_shared/rate-limit.ts";
import { writeAudit } from "../_shared/audit.ts";
import { env } from "../_shared/env.ts";
import { z } from "zod";
import type { Lottery } from "../_shared/types.ts";

const EntrySchema = z.object({
  lotteryId: z.string().uuid(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().min(7).max(20),
  email: z.string().email().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
});

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", "POST only", 405);

  const client = getAdminClient();
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  let input: z.infer<typeof EntrySchema>;
  try {
    input = EntrySchema.parse(await req.json());
  } catch (err) {
    return errorResponse("VALIDATION_ERROR", (err as Error).message, 422);
  }

  // Load lottery and validate it is open.
  const { data: lottery, error: lotErr } = await client
    .from("lotteries")
    .select("*")
    .eq("id", input.lotteryId)
    .is("deleted_at", null)
    .single<Lottery>();

  if (lotErr || !lottery) return errorResponse("LOTTERY_NOT_FOUND", "Lottery not found", 404);
  if (lottery.status !== "open") return errorResponse("LOTTERY_NOT_OPEN", "Lottery is not open", 409);

  // Rate limiting + duplicate detection.
  const phoneLimit = lottery.rate_limit_per_phone ?? 3;
  const ipLimit = lottery.rate_limit_per_ip ?? 10;
  if (!(await checkRateLimit(client, "phone", input.phone, lottery.id, phoneLimit))) {
    return errorResponse("RATE_LIMITED", "Too many attempts for this phone", 429);
  }
  if (ip && !(await checkRateLimit(client, "ip", ip, lottery.id, ipLimit))) {
    return errorResponse("RATE_LIMITED", "Too many attempts from this IP", 429);
  }
  if (await isDuplicatePhone(client, lottery.id, input.phone)) {
    return errorResponse("DUPLICATE_PHONE", "This phone already has an entry", 409);
  }

  // Create Sola hosted checkout session (authorize for the MAX of the range).
  const gateway = getPaymentGateway();
  const returnUrl = `${env.appUrl()}/confirmation?lottery=${lottery.id}`;
  let session;
  try {
    session = await gateway.createSession({
      lotteryId: lottery.id,
      minAmountCents: lottery.min_charge * 100,
      maxAmountCents: lottery.max_charge * 100,
      customerPhone: input.phone,
      customerEmail: input.email ?? null,
      customerName: `${input.firstName} ${input.lastName}`,
      channel: "web",
      returnUrl,
      metadata: {
        first_name: input.firstName,
        last_name: input.lastName,
        phone: input.phone,
        email: input.email ?? "",
        address: input.address ?? "",
      },
    });
  } catch (err) {
    return errorResponse("PAYMENT_SESSION_FAILED", (err as Error).message, 502);
  }

  // Persist a pending payment tied to the session for webhook reconciliation.
  await client.from("payments").insert({
    lottery_id: lottery.id,
    gateway: gateway.name,
    session_id: session.sessionId,
    status: "pending",
    amount_cents: 0,
    authorized_cents: lottery.max_charge * 100,
    raw_response: session.raw as Record<string, unknown>,
  });

  await writeAudit(client, {
    event: "PARTICIPANT_REGISTERED",
    actorType: "web",
    lotteryId: lottery.id,
    data: { stage: "session_created", sessionId: session.sessionId, channel: "web" },
    ipAddress: ip,
  });

  return jsonResponse({
    sessionId: session.sessionId,
    checkoutUrl: session.hostedUrl,
    expiresAt: session.expiresAt,
  });
});
