// ============================================================
// enter-lottery — WEB entry (synchronous, no webhook).
//
// The frontend collects the card via Sola iFields, which yields
// single-use tokens (SUT). It posts those tokens + entrant info here.
// This function then, in one request:
//   1. Validates the lottery + rate limits + duplicate phone.
//   2. cc:authonly for the range MAX (Sola/Cardknox Transaction API).
//   3. Atomically assigns an unused ticket (SERIALIZABLE).
//   4. Captures EXACTLY the ticket amount; voids the auth on failure.
//   5. Sends SMS + email and returns the ticket number.
//
// Raw card data never reaches this function — only iFields tokens.
// This is the SAME backend contract the phone flow uses.
// ============================================================

import { handlePreflight, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { getPaymentGateway } from "../_shared/payment/factory.ts";
import { finalizeEntry, EntryError } from "../_shared/entry-service.ts";
import { checkRateLimit, isDuplicatePhone } from "../_shared/rate-limit.ts";
import { writeAudit } from "../_shared/audit.ts";
import { z } from "zod";
import type { Lottery } from "../_shared/types.ts";

const EntrySchema = z.object({
  lotteryId: z.string().uuid(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().min(7).max(20),
  email: z.string().email().optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  // iFields single-use tokens + non-sensitive card metadata.
  cardToken: z.string().min(1), // SUT for xCardNum
  cvvToken: z.string().optional(), // SUT for xCVV
  exp: z.string().regex(/^\d{4}$/, "exp must be MMYY"),
  zip: z.string().max(10).optional(),
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

  const gateway = getPaymentGateway();

  // 1. Authorize the card for the range MAX (pre-auth).
  let auth;
  try {
    auth = await gateway.authorize({
      amountCents: lottery.max_charge * 100,
      invoice: `${lottery.id.slice(0, 8)}-${Date.now()}`,
      cardNumber: input.cardToken,
      cvv: input.cvvToken,
      exp: input.exp,
      name: `${input.firstName} ${input.lastName}`,
      email: input.email ?? undefined,
      zip: input.zip,
    });
  } catch (err) {
    return errorResponse("PAYMENT_AUTH_FAILED", (err as Error).message, 502);
  }

  if (!auth.approved) {
    await writeAudit(client, {
      event: "PAYMENT_FAILED",
      actorType: "web",
      lotteryId: lottery.id,
      data: { stage: "authorize", code: auth.errorCode, message: auth.errorMessage },
      ipAddress: ip,
    });
    return errorResponse("PAYMENT_DECLINED", auth.errorMessage ?? "Card was declined", 402);
  }

  await writeAudit(client, {
    event: "PAYMENT_AUTHORIZED",
    actorType: "web",
    lotteryId: lottery.id,
    data: { refNum: auth.refNum, authorizedCents: auth.authorizedCents },
    ipAddress: ip,
  });

  // 2. Assign ticket + capture exact amount + notify (voids auth on failure).
  try {
    const result = await finalizeEntry(client, gateway, {
      lottery,
      refNum: auth.refNum,
      authorizedCents: auth.authorizedCents,
      channel: "web",
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      email: input.email ?? null,
      address: input.address ?? null,
      ipAddress: ip,
      gatewayRawAuth: auth.raw,
    });

    return jsonResponse({
      ticketNumber: result.ticketNumber,
      amountDollars: result.amountDollars,
      refNum: auth.refNum,
    });
  } catch (err) {
    const code = err instanceof EntryError ? err.code : "ENTRY_FAILED";
    const status = code === "LOTTERY_SOLD_OUT" ? 409 : 400;
    return errorResponse(code, (err as Error).message, status);
  }
});
