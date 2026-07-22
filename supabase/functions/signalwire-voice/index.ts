// ============================================================
// signalwire-voice — inbound VOICE IVR (PRIMARY channel).
// A LaML state machine driven by ?step=... query params.
//
// Flow:
//   welcome   -> greeting + lottery info + charge explanation
//   confirm   -> DTMF 1 = continue, 9 = exit (max 3 invalid retries)
//   name      -> capture caller name (speech); phone from caller ID
//   card      -> DTMF card number (finish with #)
//   exp       -> DTMF expiration MMYY
//   cvv       -> DTMF CVV (finish with #), then authorize + finalize
//   done      -> read ticket number back + hangup
//
// Card digits are collected via DTMF and sent straight to Sola's
// Transaction API (cc:authonly). They are held transiently on the
// call_logs row only across steps and SCRUBBED immediately after the
// authorization. For maximum PCI reduction, swap DTMF capture for
// Sola's PCI IVR / DTMF-suppression product in production.
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

/** Resolve a prompt slot: DB voice_prompts override -> fallback text. */
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

/** Read/merge/scrub the transient card+context stash on the call log. */
async function getStash(
  client: ReturnType<typeof getAdminClient>,
  callSid: string,
): Promise<Record<string, string>> {
  const { data } = await client.from("call_logs").select("events").eq("call_sid", callSid)
    .maybeSingle();
  return (data?.events?.[0] ?? {}) as Record<string, string>;
}

async function setStash(
  client: ReturnType<typeof getAdminClient>,
  callSid: string,
  patch: Record<string, string>,
): Promise<void> {
  const current = await getStash(client, callSid);
  await client.from("call_logs").update({ events: [{ ...current, ...patch }] })
    .eq("call_sid", callSid);
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    const url = new URL(req.url);
  const step = url.searchParams.get("step") ?? "welcome";
  const attempts = Number(url.searchParams.get("attempts") ?? "0");
  const client = getAdminClient();

  const form = await req.formData().catch(() => new FormData());
  const params: Record<string, string> = {};
  for (const [k, v] of form.entries()) params[k] = String(v);
  const signature = req.headers.get("x-signalwire-signature");
  await verifySignalWireSignature(req.url, params, signature).catch(() => false);

  const callSid = params.CallSid ?? "";
  const fromNumber = params.From ?? "";
  const speechResult = params.SpeechResult ?? "";
  const digits = params.Digits ?? "";

  const lottery = await loadActiveLottery(client);
  const b = new LamlBuilder();
  const stepUrl = (s: string, extra = "") => `${FN_BASE}?step=${s}${extra}`;

  if (!lottery) {
    b.say("We're sorry. There are no active lotteries at this time. Goodbye.");
    b.hangup();
    return b.toResponse();
  }

  if (step === "welcome" && callSid) {
    await client.from("call_logs").upsert({
      call_sid: callSid,
      lottery_id: lottery.id,
      from_number: fromNumber,
      direction: "inbound",
      status: "in-progress",
      events: [{}],
    }, { onConflict: "call_sid" });
  }

  switch (step) {
    case "welcome": {
      const greeting = await prompt(client, lottery.id, "welcome_greeting", `Welcome to ${lottery.name}.`);
      const explanation = await prompt(
        client, lottery.id, "lottery_explanation",
        `The prize is ${lottery.prize_text ?? "a great prize"}. You will be charged a randomly ` +
          `selected amount between ${lottery.min_charge} and ${lottery.max_charge} dollars. ` +
          `That amount becomes your ticket number.`,
      );
      b.say(greeting);
      b.pause(1);
      b.say(explanation);
      b.gather({ action: stepUrl("confirm"), numDigits: 1, timeout: 8 }, (g) => {
        g.say("Press 1 to continue, or press 9 to exit.");
      });
      b.redirect(stepUrl("welcome"));
      return b.toResponse();
    }

    case "confirm": {
      if (digits === "1") {
        if (await isDuplicatePhone(client, lottery.id, fromNumber)) {
          b.say("Our records show you already have an entry in this lottery. Goodbye.");
          b.hangup();
          return b.toResponse();
        }
        b.gather(
          { action: stepUrl("card"), input: "speech", speechTimeout: "auto", timeout: 10 },
          (g) => g.say("Please say your first and last name."),
        );
        // If no speech is captured, continue anyway (name defaults to caller).
        b.redirect(stepUrl("card"));
        return b.toResponse();
      }
      if (digits === "9") {
        b.redirect(stepUrl("goodbye"));
        return b.toResponse();
      }
      if (attempts >= 2) {
        b.say("Too many invalid attempts. Goodbye.");
        b.hangup();
        return b.toResponse();
      }
      b.say("Sorry, I didn't get that.");
      b.gather({ action: stepUrl("confirm", `&attempts=${attempts + 1}`), numDigits: 1 }, (g) =>
        g.say("Press 1 to continue, or 9 to exit."));
      b.redirect(stepUrl("confirm", `&attempts=${attempts + 1}`));
      return b.toResponse();
    }

    case "card": {
      // Prior step captured the spoken name.
      const fullName = (speechResult || "Phone Caller").trim();
      const [firstName, ...rest] = fullName.split(" ");
      await setStash(client, callSid, {
        first_name: firstName || "Phone",
        last_name: rest.join(" ") || "Caller",
      });
      b.say(
        `Thank you. You are entering the ${lottery.name} raffle. You will be charged a random ` +
          `amount between ${lottery.min_charge} and ${lottery.max_charge} dollars, and that exact ` +
          `amount becomes your raffle ticket number.`,
      );
      b.gather({ action: stepUrl("exp"), numDigits: 19, finishOnKey: "#", timeout: 20 }, (g) =>
        g.say("Please enter your card number, followed by the pound key."));
      b.redirect(stepUrl("goodbye"));
      return b.toResponse();
    }

    case "exp": {
      await setStash(client, callSid, { card: digits });
      b.gather({ action: stepUrl("cvv"), numDigits: 4, timeout: 12 }, (g) =>
        g.say("Enter your card expiration as four digits. For example, for December 2030, enter 1 2 3 0."));
      b.redirect(stepUrl("goodbye"));
      return b.toResponse();
    }

    case "cvv": {
      await setStash(client, callSid, { exp: digits });
      // 3-digit CVV auto-submits (no pound needed) so the call reliably
      // reaches the payment step.
      b.gather({ action: stepUrl("process"), numDigits: 3, timeout: 12 }, (g) =>
        g.say("Finally, enter your three digit card security code."));
      b.redirect(stepUrl("goodbye"));
      return b.toResponse();
    }

    case "process": {
      const stash = await getStash(client, callSid);
      const cvv = digits;
      const gateway = getPaymentGateway();

      // Authorize the range MAX, then SCRUB card data immediately.
      // Any gateway error is caught here so the call ends gracefully
      // (an unhandled throw would 500 and SignalWire would drop the call).
      let auth;
      try {
        auth = await gateway.authorize({
          amountCents: lottery.max_charge * 100,
          invoice: `${lottery.id.slice(0, 8)}-${callSid.slice(-8)}-${Date.now()}`,
          cardNumber: stash.card ?? "",
          cvv,
          exp: stash.exp ?? "",
          name: `${stash.first_name ?? ""} ${stash.last_name ?? ""}`.trim(),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await client.from("call_logs").update({
          status: "auth_error",
          events: [{
            first_name: stash.first_name, last_name: stash.last_name,
            stage: "authorize_exception", error: message, scrubbed: "true",
          }],
        }).eq("call_sid", callSid);
        b.say("We're sorry, we could not reach our payment system. Please try again later. Goodbye.");
        b.hangup();
        return b.toResponse();
      }

      // Scrub card/exp from the transient stash now that auth is done.
      await client.from("call_logs").update({
        events: [{
          first_name: stash.first_name, last_name: stash.last_name,
          auth_result: auth.approved ? "approved" : "declined",
          auth_error: auth.errorMessage ?? null, auth_code: auth.errorCode ?? null,
          ref_num: auth.refNum ?? null, scrubbed: "true",
        }],
      }).eq("call_sid", callSid);

      if (!auth.approved) {
        b.say(
          `We could not authorize your card. ${auth.errorMessage ? "" : ""}` +
            "Please check your card details and try again later. Goodbye.",
        );
        b.hangup();
        return b.toResponse();
      }

      try {
        const result = await finalizeEntry(client, gateway, {
          lottery,
          refNum: auth.refNum,
          authorizedCents: auth.authorizedCents,
          channel: "phone",
          firstName: stash.first_name ?? "Phone",
          lastName: stash.last_name ?? "Caller",
          phone: fromNumber,
          gatewayRawAuth: auth.raw,
        });

        await client.from("call_logs").update({ status: "completed" }).eq("call_sid", callSid);

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
  } catch (_err) {
    // Never 500 to SignalWire (it would drop the call). End gracefully.
    const fb = new LamlBuilder();
    fb.say("We're sorry, an unexpected error occurred. Please try again later. Goodbye.");
    fb.hangup();
    return fb.toResponse();
  }
});
