// Deno tests for Sola webhook signature verification + redaction behavior.
// Run: deno test --allow-all
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// Set required env BEFORE importing the gateway module.
Deno.env.set("SOLA_WEBHOOK_SECRET", "test-secret");
Deno.env.set("SOLA_API_KEY", "k");
Deno.env.set("SOLA_API_SECRET", "s");
Deno.env.set("SOLA_MERCHANT_ID", "m");

const { SolaPaymentsGateway } = await import("../_shared/payment/sola.ts");

async function sign(body: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.test("verifyWebhookSignature accepts a valid signature", async () => {
  const gw = new SolaPaymentsGateway();
  const body = JSON.stringify({ type: "authorization.succeeded" });
  const sig = await sign(body, "test-secret");
  assert(await gw.verifyWebhookSignature(body, `sha256=${sig}`));
  assert(await gw.verifyWebhookSignature(body, sig)); // without prefix
});

Deno.test("verifyWebhookSignature rejects a tampered signature", async () => {
  const gw = new SolaPaymentsGateway();
  const body = JSON.stringify({ type: "authorization.succeeded" });
  const bad = await sign(body + "x", "test-secret");
  assertEquals(await gw.verifyWebhookSignature(body, bad), false);
});

Deno.test("verifyWebhookSignature rejects a missing signature", async () => {
  const gw = new SolaPaymentsGateway();
  assertEquals(await gw.verifyWebhookSignature("{}", null), false);
});
