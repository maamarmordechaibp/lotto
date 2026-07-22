// Deno tests for the Sola (Cardknox) Transaction API gateway.
// Mocks fetch to verify request shaping + response mapping.
// Run: deno test --allow-all
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

Deno.env.set("SOLA_API_KEY", "test_key");
Deno.env.set("SOLA_API_BASE_URL", "https://x1.cardknox.com");

const { SolaPaymentsGateway } = await import("../_shared/payment/sola.ts");

function mockFetch(response: Record<string, unknown>) {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  globalThis.fetch = ((url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? "{}")) });
    return Promise.resolve(
      new Response(JSON.stringify(response), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
  }) as typeof fetch;
  return calls;
}

Deno.test("authorize sends cc:authonly and maps an approval", async () => {
  const calls = mockFetch({ xResult: "A", xRefNum: "999", xAuthAmount: "500.00", xToken: "tok_1" });
  const gw = new SolaPaymentsGateway();
  const res = await gw.authorize({
    amountCents: 50000, invoice: "inv1", cardNumber: "sut_card", cvv: "sut_cvv", exp: "1230", name: "Jane Doe",
  });

  assertEquals(calls[0].url, "https://x1.cardknox.com/gatewayjson");
  assertEquals(calls[0].body.xCommand, "cc:authonly");
  assertEquals(calls[0].body.xKey, "test_key");
  assertEquals(calls[0].body.xAmount, "500.00");
  assertEquals(calls[0].body.xCardNum, "sut_card");
  assert(res.approved);
  assertEquals(res.refNum, "999");
  assertEquals(res.authorizedCents, 50000);
  assertEquals(res.token, "tok_1");
});

Deno.test("authorize maps a decline with error info", async () => {
  mockFetch({ xResult: "D", xRefNum: "1000", xError: "Declined", xErrorCode: "01334" });
  const gw = new SolaPaymentsGateway();
  const res = await gw.authorize({ amountCents: 10000, invoice: "i", cardNumber: "c", exp: "1230" });
  assertEquals(res.approved, false);
  assertEquals(res.errorMessage, "Declined");
  assertEquals(res.errorCode, "01334");
});

Deno.test("capture sends cc:capture with the exact amount", async () => {
  const calls = mockFetch({ xResult: "A", xRefNum: "999" });
  const gw = new SolaPaymentsGateway();
  const res = await gw.capture("999", 24700);
  assertEquals(calls[0].body.xCommand, "cc:capture");
  assertEquals(calls[0].body.xRefNum, "999");
  assertEquals(calls[0].body.xAmount, "247.00");
  assert(res.captured);
  assertEquals(res.capturedCents, 24700);
});

Deno.test("voidAuth sends cc:void", async () => {
  const calls = mockFetch({ xResult: "A", xRefNum: "999" });
  const gw = new SolaPaymentsGateway();
  const res = await gw.voidAuth("999");
  assertEquals(calls[0].body.xCommand, "cc:void");
  assert(res.voided);
});

Deno.test("refund sends cc:refund and reports status", async () => {
  const calls = mockFetch({ xResult: "A", xRefNum: "999" });
  const gw = new SolaPaymentsGateway();
  const res = await gw.refund("999", 5000);
  assertEquals(calls[0].body.xCommand, "cc:refund");
  assertEquals(res.status, "refunded");
  assertEquals(res.refundedCents, 5000);
});
