// ============================================================
// _shared/payment/sola.ts
// SolaPaymentsGateway — default implementation of PaymentGateway.
//
// Sola runs on the Cardknox Transaction API (synchronous, no card
// webhooks). Requests are POSTed as JSON to /gatewayjson and are
// authenticated with the account key (xKey = SOLA_API_KEY).
//
//   cc:authonly -> authorize (range MAX)
//   cc:capture  -> capture the EXACT ticket amount
//   cc:void     -> void when no ticket can be assigned
//   cc:refund   -> admin refund
//
// Card data reaches us only as iFields single-use tokens (web) or a
// PCI IVR (phone); raw PAN/CVV is never stored. Responses are redacted
// before persistence.
// ============================================================

import type { PaymentGateway } from "./gateway.ts";
import type {
  AuthorizeParams,
  AuthResult,
  CaptureResult,
  RefundResult,
  TransactionStatus,
  VoidResult,
} from "../types.ts";
import { env } from "../env.ts";

const SOFTWARE_NAME = "VoiceFirstLottery";
const SOFTWARE_VERSION = "2.0.0";
const API_VERSION = "5.0.0";

/** Strip sensitive fields from any gateway payload before it touches the DB. */
function redact(raw: unknown): unknown {
  if (raw === null || typeof raw !== "object") return raw;
  const SENSITIVE = new Set([
    "xcardnum", "xcvv", "xexp", "card_number", "pan", "cvv", "cvc", "cvv2",
    "account_number", "xaccount", "xrouting",
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

/** Cardknox amounts are decimal dollar strings. */
function centsToAmount(cents: number): string {
  return (cents / 100).toFixed(2);
}

function amountToCents(amount: string | number | undefined): number {
  if (amount === undefined) return 0;
  return Math.round(parseFloat(String(amount)) * 100);
}

interface CardknoxResponse {
  xResult?: string; // A | D | E | V
  xStatus?: string;
  xError?: string;
  xErrorCode?: string;
  xRefNum?: string;
  xAuthAmount?: string;
  xAuthCode?: string;
  xToken?: string;
  xMaskedCardNumber?: string;
  [key: string]: unknown;
}

export class SolaPaymentsGateway implements PaymentGateway {
  readonly name = "sola";

  private get endpoint(): string {
    // Default to Cardknox primary (x1); x2/b1 are failover hosts.
    return `${env.solaBaseUrl().replace(/\/$/, "")}/gatewayjson`;
  }

  private async send(fields: Record<string, string | undefined>): Promise<CardknoxResponse> {
    const body: Record<string, string> = {
      xKey: env.solaApiKey(),
      xVersion: API_VERSION,
      xSoftwareName: SOFTWARE_NAME,
      xSoftwareVersion: SOFTWARE_VERSION,
    };
    for (const [k, v] of Object.entries(fields)) {
      if (v !== undefined && v !== "") body[k] = v;
    }

    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let parsed: CardknoxResponse;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      throw new SolaError("PARSE_ERROR", `Non-JSON gateway response (${res.status})`, res.status, text);
    }
    if (!res.ok) {
      throw new SolaError(
        parsed.xErrorCode ?? "SOLA_HTTP_ERROR",
        parsed.xError ?? `Gateway HTTP ${res.status}`,
        res.status,
        redact(parsed),
      );
    }
    return parsed;
  }

  async authorize(params: AuthorizeParams): Promise<AuthResult> {
    const data = await this.send({
      xCommand: "cc:authonly",
      xAmount: centsToAmount(params.amountCents),
      xCardNum: params.cardNumber, // iFields SUT or keyed PAN
      xCVV: params.cvv,
      xExp: params.exp,
      xName: params.name,
      xEmail: params.email,
      xStreet: params.street,
      xZip: params.zip,
      xInvoice: params.invoice,
      xAllowDuplicate: params.allowDuplicate ? "true" : undefined,
    });

    const approved = data.xResult === "A";
    return {
      refNum: data.xRefNum ?? "",
      authorizedCents: amountToCents(data.xAuthAmount),
      approved,
      token: data.xToken,
      errorCode: approved ? undefined : data.xErrorCode,
      errorMessage: approved ? undefined : data.xError,
      raw: redact(data),
    };
  }

  async capture(refNum: string, amountCents: number): Promise<CaptureResult> {
    // Capture EXACTLY the ticket amount (<= authorized).
    const data = await this.send({
      xCommand: "cc:capture",
      xRefNum: refNum,
      xAmount: centsToAmount(amountCents),
    });
    const captured = data.xResult === "A";
    return {
      refNum: data.xRefNum ?? refNum,
      capturedCents: captured ? amountCents : 0,
      captured,
      raw: redact(data),
    };
  }

  async voidAuth(refNum: string): Promise<VoidResult> {
    const data = await this.send({ xCommand: "cc:void", xRefNum: refNum });
    return { refNum: data.xRefNum ?? refNum, voided: data.xResult === "A", raw: redact(data) };
  }

  async refund(refNum: string, amountCents: number): Promise<RefundResult> {
    const data = await this.send({
      xCommand: "cc:refund",
      xRefNum: refNum,
      xAmount: centsToAmount(amountCents),
    });
    return {
      refNum: data.xRefNum ?? refNum,
      refundedCents: data.xResult === "A" ? amountCents : 0,
      status: data.xResult === "A" ? "refunded" : "failed",
      raw: redact(data),
    };
  }

  async getStatus(refNum: string): Promise<TransactionStatus> {
    // Cardknox has a separate reporting API; for our needs we report the
    // reference back. Extend with xReport:* if detailed status is required.
    return { refNum, status: "captured", amountCents: 0, raw: { refNum } };
  }
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
