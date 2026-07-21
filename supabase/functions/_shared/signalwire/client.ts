// ============================================================
// _shared/signalwire/client.ts
// SignalWire REST helpers: outbound SMS + webhook signature check.
// ============================================================

import { env } from "../env.ts";

/** Send an SMS via SignalWire Messaging API. */
export async function sendSms(to: string, body: string): Promise<{ sid: string }> {
  const space = env.signalwireSpaceUrl().replace(/\/$/, "");
  const url =
    `https://${space}/api/laml/2010-04-01/Accounts/${env.signalwireProjectId()}/Messages.json`;

  const form = new URLSearchParams({
    From: env.signalwirePhoneNumber(),
    To: to,
    Body: body,
  });

  const auth = btoa(`${env.signalwireProjectId()}:${env.signalwireApiToken()}`);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message ?? `SignalWire SMS failed (${res.status})`);
  }
  return { sid: data.sid };
}

/**
 * Verify a SignalWire webhook signature (X-SignalWire-Signature).
 * SignalWire signs sha1(url + sorted POST params) with the auth token.
 */
export async function verifySignalWireSignature(
  url: string,
  params: Record<string, string>,
  signature: string | null,
): Promise<boolean> {
  if (!signature) return false;
  const sorted = Object.keys(params).sort();
  let data = url;
  for (const key of sorted) data += key + params[key];

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(env.signalwireApiToken()),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return expected === signature;
}
