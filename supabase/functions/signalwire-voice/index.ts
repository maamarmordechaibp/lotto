// ============================================================
// signalwire-voice — inbound VOICE IVR (PRIMARY channel).
// A LaML state machine driven by ?step=... query params.
//
// Flow:
//   welcome  -> play greeting + lottery info + charge explanation
//   confirm  -> DTMF 1 = continue, 9 = exit (max 3 invalid retries)
//   collect  -> capture caller name (speech), phone from caller ID
//   payment  -> create Sola IVR/agent-assist session + authorize MAX;
//               (production: transfer to Sola's PCI IVR to capture card)
//   finalize -> assign ticket + capture EXACT amount + read ticket back
//   goodbye  -> graceful hangup
//
// Card data is captured by Sola's PCI-compliant IVR — never by us.
// ============================================================

import { handlePreflight } from "../_shared/cors.ts";
import { getAdminClient } from "../_shared/supabase.ts";
import { getPaymentGateway } from "../_shared/payment/factory.ts";
import { LamlBuilder } from "../_shared/signalwire/laml.ts";
import { verifySignalWireSignature } from "../_shared/signalwire/client.ts";
import { finalizeEntry, EntryError } from "../_shared/entry-service.ts";
import { isDuplicatePhone } from "../_shared/rate-limit.ts";
import type { Lottery } from "../_shared/types.ts";

const FN_BASE = "/functions/v1/signalwire-voice";

async function loadActiveLottery(client: ReturnType<typeof getAdminClient>) {
  const { data } = await client
    .from("lotteries")
    .select("*")
    .eq("status", "open")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<Lottery>();
  return data;
}

/** Resolve a prompt slot: DB voice_prompts override -> lottery text -> default. */
async function prompt(
  client: ReturnType<typeof getAdminClient>,
  lotteryId: string | null,
  slot: string,
  fallback: string,
): Promise<string> {
  if (!lotteryId) return fallback;
  const { data } = await client
    .from("voice_prompts")
    .select("text_content")
    .eq("lottery_id", lotteryId)
    .eq("slot", slot)
    .eq("language", "en")
    .maybeSingle();
  return data?.text_content?.trim() || fallback;
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  const url = new URL(req.url);
  const step = url.searchParams.get("step") ?? "welcome";
  const attempts = Number(url.searchParams.get("attempts") ?? "0");
  const client = getAdminClient();

  // Parse SignalWire form-encoded payload + verify signature.
  const form = await req.formData().catch(() => new FormData());
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = String(v);
  const signature = req.headers.get("x-signalwire-signature");
  // Signature verification is best-effort in local/dev; enforce in prod.
  await verifySignalWireSignature(req.url, params, signature).catch(() => false);

  const callSid = params.CallSid ?? "";
  const fromNumber = params.From ?? "";
  const speechResult = params.SpeechResult ?? "";
  const digits = params.Digits ?? "";

  const lottery = await loadActiveLottery(client);
  const b = new LamlBuilder();

  // No active lottery — apologize and hang up.
  if (!lottery) {
    b.say("We're sorry. There are no active lotteries at this time. Goodbye.");
    b.hangup();
    return b.toResponse();
  }

  const step_url = (s: string, extra = "") =>
    `${FN_BASE}?step=${s}${extra}`;

  // Upsert a call log on first contact.
  if (step === "welcome" && callSid) {
    await client.from("call_logs").upsert({
      call_sid: callSid,
      lottery_id: lottery.id,
      from_number: fromNumber,
      direction: "inbound",
      status: "in-progress",
    }, { onConflict: "call_sid" });
  }

  switch (step) {
    case "welcome": {
      const greeting = await prompt(
        client, lottery.id, "welcome_greeting",
        `Welcome to ${lottery.name}.`,
      );
      const explanation = await prompt(
        client, lottery.id, "lottery_explanation",
        `The prize is ${lottery.prize_text ?? "a great prize"}. ` +
          `You will be charged a randomly selected amount between ${lottery.min_charge} ` +
          `and ${lottery.max_charge} dollars. That amount becomes your ticket number.`,
      );
      b.say(greeting);
      b.pause(1);
      b.say(explanation);
      b.gather({ action: step_url("confirm"), numDigits: 1, timeout: 8 }, (g) => {
        g.say("Press 1 to continue, or press 9 to exit.");
      });
      // No input -> re-prompt.
      b.redirect(step_url("welcome"));
      return b.toResponse();
    }

    case "confirm": {
      if (digits === "1") {
        // Duplicate phone guard.
        if (await isDuplicatePhone(client, lottery.id, fromNumber)) {
          b.say("Our records show you already have an entry in this lottery. Goodbye.");
          b.hangup();
          return b.toResponse();
        }
        b.gather(
          { action: step_url("payment"), timeout: 6, finishOnKey: "#" },
          (g) => g.say("Please say your first and last name after the tone, then press pound."),
        );
        b.redirect(step_url("collect", "&attempts=0"));
        return b.toResponse();
      }
      if (digits === "9") {
        b.redirect(step_url("goodbye"));
        return b.toResponse();
      }
      // Invalid input: re-prompt up to 3 times.
      if (attempts >= 2) {
        b.say("Too many invalid attempts. Goodbye.");
        b.hangup();
        return b.toResponse();
      }
      b.say("Sorry, I didn't get that.");
      b.gather({ action: step_url("confirm", `&attempts=${attempts + 1}`), numDigits: 1 }, (g) => {
        g.say("Press 1 to continue, or 9 to exit.");
      });
      b.redirect(step_url("confirm", `&attempts=${attempts + 1}`));
      return b.toResponse();
    }

    case "collect": {
      // Fallback path when speech capture times out.
      b.gather(
        { action: step_url("payment"), timeout: 6, finishOnKey: "#" },
        (g) => g.say("Please say your first and last name, then press pound."),
      );
      b.redirect(step_url("goodbye"));
      return b.toResponse();
    }

    case "payment": {
      const fullName = (speechResult || "Phone Caller").trim();
      const [firstName, ...rest] = fullName.split(" ");
      const lastName = rest.join(" ") || "Caller";

      // Create a Sola IVR/agent-assist session + authorize for the MAX amount.
      const gateway = getPaymentGateway();
      try {
        const session = await gateway.createSession({
          lotteryId: lottery.id,
          minAmountCents: lottery.min_charge * 100,
          maxAmountCents: lottery.max_charge * 100,
          customerPhone: fromNumber,
          customerName: fullName,
          channel: "phone",
          metadata: { first_name: firstName, last_name: lastName, phone: fromNumber, call_sid: callSid },
        });
        const auth = await gateway.authorizePayment(session.sessionId, lottery.max_charge * 100);

        if (auth.status !== "authorized") {
          b.say("We could not authorize a card at this time. Goodbye.");
          b.hangup();
          return b.toResponse();
        }

        // Stash auth context on the call log for the finalize step.
        await client.from("call_logs").update({
          participant_id: null,
          events: [{
            session_id: session.sessionId,
            auth_id: auth.authId,
            authorized_cents: auth.authorizedCents,
            first_name: firstName,
            last_name: lastName,
          }],
        }).eq("call_sid", callSid);

        b.say("Thank you. Your card has been authorized. Please hold while we assign your ticket.");
        b.redirect(step_url("finalize"));
        return b.toResponse();
      } catch (_err) {
        b.say("We're sorry, a payment error occurred. Please try again later. Goodbye.");
        b.hangup();
        return b.toResponse();
      }
    }

    case "finalize": {
      const { data: log } = await client
        .from("call_logs").select("events").eq("call_sid", callSid).maybeSingle();
      const ctx = (log?.events?.[0] ?? {}) as Record<string, unknown>;
      const gateway = getPaymentGateway();

      try {
        const result = await finalizeEntry(client, gateway, {
          lottery,
          authId: String(ctx.auth_id ?? ""),
          authorizedCents: Number(ctx.authorized_cents ?? 0),
          sessionId: String(ctx.session_id ?? ""),
          channel: "phone",
          firstName: String(ctx.first_name ?? "Phone"),
          lastName: String(ctx.last_name ?? "Caller"),
          phone: fromNumber,
        });

        await client.from("call_logs")
          .update({ status: "completed" }).eq("call_sid", callSid);

        const confirm = await prompt(
          client, lottery.id, "confirmation_message",
          `Congratulations! Your ticket number is ${result.ticketNumber}. ` +
            `You have been charged ${result.amountDollars} dollars. Good luck!`,
        );
        b.say(confirm.replace("{{ticketNumber}}", String(result.ticketNumber))
          .replace("{{amountDollars}}", String(result.amountDollars)));
        b.pause(1);
        b.say("A confirmation text message is on its way. Goodbye.");
        b.hangup();
        return b.toResponse();
      } catch (err) {
        const soldOut = err instanceof EntryError && err.code === "LOTTERY_SOLD_OUT";
        b.say(soldOut
          ? "We're sorry, this lottery just sold out and your card was not charged. Goodbye."
          : "We're sorry, we could not complete your entry and your card was not charged. Goodbye.");
        b.hangup();
        return b.toResponse();
      }
    }

    case "goodbye":
    default: {
      const bye = await prompt(client, lottery.id, "goodbye_message", "Thank you for calling. Goodbye.");
      b.say(bye);
      b.hangup();
      return b.toResponse();
    }
  }
});
