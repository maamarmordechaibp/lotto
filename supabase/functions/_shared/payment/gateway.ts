// ============================================================
// _shared/payment/gateway.ts
// PaymentGateway interface — every payment operation flows
// through this abstraction. Providers implement it; business
// logic never depends on a concrete provider.
//
// Model: token-based authorize -> capture -> void/refund
// (matches Sola/Cardknox and most modern card gateways).
// ============================================================

import type {
  AuthorizeParams,
  AuthResult,
  CaptureResult,
  RefundResult,
  TransactionStatus,
  VoidResult,
} from "../types.ts";

export interface PaymentGateway {
  /** Human-readable provider name persisted to payments.gateway. */
  readonly name: string;

  /**
   * Authorize a card (iFields SUT or keyed) for `amountCents` — typically the
   * range MAX. Returns a reference number used for capture/void.
   */
  authorize(params: AuthorizeParams): Promise<AuthResult>;

  /** Capture EXACTLY `amountCents` (the ticket amount) against an auth. */
  capture(refNum: string, amountCents: number): Promise<CaptureResult>;

  /** Void an authorization that was never captured (e.g. no ticket available). */
  voidAuth(refNum: string): Promise<VoidResult>;

  /** Refund `amountCents` from a captured/settled transaction. */
  refund(refNum: string, amountCents: number): Promise<RefundResult>;

  /** Fetch the current status of a transaction. */
  getStatus(refNum: string): Promise<TransactionStatus>;
}

export type {
  AuthorizeParams,
  AuthResult,
  CaptureResult,
  RefundResult,
  TransactionStatus,
  VoidResult,
};

