// ============================================================
// _shared/payment/gateway.ts
// PaymentGateway interface — every payment operation flows
// through this abstraction. Providers implement it; business
// logic never depends on a concrete provider.
// ============================================================

import type {
  AuthResult,
  CaptureResult,
  PaymentSession,
  PaymentSessionParams,
  RefundResult,
  TransactionStatus,
  VoidResult,
} from "../types.ts";

export interface PaymentGateway {
  /** Human-readable provider name persisted to payments.gateway. */
  readonly name: string;

  /** Create a hosted (web) or phone-entry (voice/IVR) payment session. */
  createSession(params: PaymentSessionParams): Promise<PaymentSession>;

  /** Authorize a card for `amountCents` (typically the MAX range amount). */
  authorizePayment(sessionId: string, amountCents: number): Promise<AuthResult>;

  /** Capture EXACTLY `amountCents` (the ticket amount) against an auth. */
  capturePayment(authId: string, amountCents: number): Promise<CaptureResult>;

  /** Refund `amountCents` from a settled/captured transaction. */
  refundPayment(transactionId: string, amountCents: number): Promise<RefundResult>;

  /** Void an authorization that was never captured (e.g. no ticket available). */
  voidPayment(authId: string): Promise<VoidResult>;

  /** Fetch the current status of a transaction. */
  getTransactionStatus(transactionId: string): Promise<TransactionStatus>;

  /** Verify a webhook signature against the raw request body. */
  verifyWebhookSignature(rawBody: string, signature: string | null): Promise<boolean>;
}

export type { PaymentSessionParams, PaymentSession, AuthResult, CaptureResult, RefundResult, VoidResult, TransactionStatus };
