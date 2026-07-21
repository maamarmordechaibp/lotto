// ============================================================
// _shared/payment/sola.ts
// SolaPaymentsGateway — default implementation of PaymentGateway.
//
// Integrates with Sola Payments (solapayments.com) via REST.
//   * Tokenized, PCI-compliant card capture (hosted page for web,
//     IVR/agent-assist session for voice).
//   * Pre-authorization then delayed capture of the exact ticket amount.
//   * Void when no ticket can be assigned.
//   * HMAC-SHA256 webhook signature verification.
//
// Raw responses are REDACTED before persistence — no PAN/CVV is ever
// stored. All secrets come from Edge Function environment secrets.
// ============================================================

import type { PaymentGateway } from "./gateway.ts";
import type {
  AuthResult,
  CaptureResult,
  PaymentSession,
  PaymentSessionParams,
  RefundResult,
  TransactionStatus,
  VoidResult,
} from "../types.ts";
import { env } from "../env.ts";

/** Strip sensitive fields from any gateway payload before it touches the DB. */
function redact(raw: unknown): unknown {
  if (raw === null || typeof raw !== "object") return raw;
  const SENSITIVE = new Set([
    "card_number", "pan", "cvv", "cvc", "cvv2", "card", "account_number",
    "expiry", "exp_month", "exp_year", "track_data",
  ]);
  const clone: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (SENSITIVE.has(k.toLowerCase())) {
      clone[k] = "***REDACTED***";
    } else if (v && typeof v === "object") {
      clone[k] = redact(v);
    } else {
      clone[k] = v;
    }
  }
  return clone;
}

export class SolaPaymentsGateway implements PaymentGateway {
  readonly name = "sola";

  private get baseUrl(): string {
    return env.solaBaseUrl().replace(/\/$/, "");
  }

  private async request<T = Record<string, unknown>>(
    path: string,
    method: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "Authorization": `Bearer ${env.solaApiKey()}`,
        "X-Merchant-Id": env.solaMerchantId(),
        "X-Sola-Environment": env.solaEnvironment(),
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await res.text();
    const parsed = text ? JSON.parse(text) : {};
    if (!res.ok) {
      const message =
        (parsed?.error?.message as string) ?? (parsed?.message as string) ??
          `Sola request failed (${res.status})`;
      throw new SolaError(
        (parsed?.error?.code as string) ?? "SOLA_ERROR",
        message,
        res.status,
        redact(parsed),
      );
    }
    return parsed as T;
  }

  async createSession(params: PaymentSessionParams): Promise<PaymentSession> {
    // For web: request a hosted checkout URL (keeps us out of PCI scope).
    // For phone: request an IVR/agent-assist card-capture session.
    const payload = {
      merchant_id: env.solaMerchantId(),
      mode: params.channel === "web" ? "hosted_checkout" : "ivr_capture",
      // Authorize for the MAX of the range; capture the exact ticket later.
      amount: params.maxAmountCents,
      min_amount: params.minAmountCents,
      currency: "USD",
      capture: false, // pre-authorization only
      customer: {
        name: params.customerName,
        phone: params.customerPhone,
        email: params.customerEmail ?? undefined,
      },
      return_url: params.returnUrl,
      metadata: { lottery_id: params.lotteryId, ...params.metadata },
    };

    const data = await this.request<{
      session_id: string;
      hosted_url?: string;
      expires_at?: string;
    }>("/v1/sessions", "POST", payload);

    return {
      sessionId: data.session_id,
      hostedUrl: data.hosted_url,
      expiresAt: data.expires_at,
      raw: redact(data),
    };
  }

  async authorizePayment(sessionId: string, amountCents: number): Promise<AuthResult> {
    const data = await this.request<{
      auth_id: string;
      authorized_amount: number;
      status: string;
    }>(`/v1/sessions/${sessionId}/authorize`, "POST", { amount: amountCents });

    return {
      authId: data.auth_id,
      authorizedCents: data.authorized_amount,
      status: data.status === "authorized" ? "authorized" : "declined",
      raw: redact(data),
    };
  }

  async capturePayment(authId: string, amountCents: number): Promise<CaptureResult> {
    // Capture EXACTLY the ticket amount, not the authorized max.
    const data = await this.request<{
      transaction_id: string;
      captured_amount: number;
      status: string;
    }>(`/v1/authorizations/${authId}/capture`, "POST", { amount: amountCents });

    return {
      transactionId: data.transaction_id,
      capturedCents: data.captured_amount,
      status: data.status === "captured" ? "captured" : "failed",
      raw: redact(data),
    };
  }

  async refundPayment(transactionId: string, amountCents: number): Promise<RefundResult> {
    const data = await this.request<{
      refund_id: string;
      refunded_amount: number;
      status: string;
      remaining_amount?: number;
    }>(`/v1/transactions/${transactionId}/refund`, "POST", { amount: amountCents });

    const status = data.status === "refunded"
      ? ((data.remaining_amount ?? 0) > 0 ? "partially_refunded" : "refunded")
      : "failed";

    return {
      refundId: data.refund_id,
      refundedCents: data.refunded_amount,
      status,
      raw: redact(data),
    };
  }

  async voidPayment(authId: string): Promise<VoidResult> {
    const data = await this.request<{ status: string }>(
      `/v1/authorizations/${authId}/void`,
      "POST",
    );
    return {
      authId,
      status: data.status === "voided" ? "voided" : "failed",
      raw: redact(data),
    };
  }

  async getTransactionStatus(transactionId: string): Promise<TransactionStatus> {
    const data = await this.request<{
      transaction_id: string;
      status: string;
      amount: number;
      settlement_status?: string;
    }>(`/v1/transactions/${transactionId}`, "GET");

    const map: Record<string, TransactionStatus["status"]> = {
      authorized: "authorized",
      captured: "captured",
      voided: "voided",
      refunded: "refunded",
      partially_refunded: "partially_refunded",
      failed: "failed",
      declined: "failed",
    };

    return {
      transactionId: data.transaction_id,
      status: map[data.status] ?? "pending",
      amountCents: data.amount,
      settlementStatus: data.settlement_status,
      raw: redact(data),
    };
  }

  async verifyWebhookSignature(rawBody: string, signature: string | null): Promise<boolean> {
    if (!signature) return false;
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(env.solaWebhookSecret()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
    const expected = [...new Uint8Array(mac)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return timingSafeEqual(expected, signature.replace(/^sha256=/, ""));
  }
}

/** Constant-time string comparison to avoid signature timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export class SolaError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public raw: unknown,
  ) {
    super(message);
  }
}
