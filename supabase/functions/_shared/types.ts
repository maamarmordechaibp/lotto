// ============================================================
// _shared/types.ts — Shared domain types (Deno / Edge Functions).
// ============================================================

export type LotteryStatus = "draft" | "open" | "paused" | "closed" | "completed";
export type EntryChannel = "phone" | "web";
export type PaymentStatusValue =
  | "pending"
  | "authorized"
  | "captured"
  | "failed"
  | "voided"
  | "refunded"
  | "partially_refunded";
export type AppRole = "super_admin" | "lottery_manager" | "support" | "viewer";

export interface Lottery {
  id: string;
  name: string;
  description: string | null;
  prize_text: string | null;
  prize_image_url: string | null;
  start_date: string;
  end_date: string;
  drawing_date: string | null;
  max_participants: number;
  min_charge: number;
  max_charge: number;
  status: LotteryStatus;
  sms_template: string | null;
  email_subject: string | null;
  email_template: string | null;
  voice_greeting_text: string | null;
  voice_greeting_url: string | null;
  currency: string;
  timezone: string;
}

export interface Participant {
  id: string;
  lottery_id: string;
  ticket_number: number;
  amount_cents: number;
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  address: string | null;
  channel: EntryChannel;
  payment_status: PaymentStatusValue;
  payment_reference: string | null;
}

export interface EntryInput {
  lotteryId: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  channel: EntryChannel;
  ipAddress?: string | null;
}

// -------- PaymentGateway domain types (Sola / Cardknox Transaction API) --------

/**
 * Card reference for an authorization:
 *  - Web:   iFields single-use tokens (SUT) for cardNumber + cvv.
 *  - Phone: keyed card entry captured by a PCI-compliant IVR.
 * The gateway never persists raw PAN/CVV; only the xRefNum/xToken it returns.
 */
export interface AuthorizeParams {
  amountCents: number; // authorize amount (typically the range MAX)
  invoice: string; // unique per attempt (duplicate protection)
  cardNumber: string; // iFields SUT (or keyed PAN for IVR)
  cvv?: string; // iFields SUT (or keyed CVV)
  exp: string; // MMYY
  name?: string;
  email?: string;
  street?: string;
  zip?: string;
  allowDuplicate?: boolean;
}

export interface AuthResult {
  refNum: string; // xRefNum — used for capture/void/refund
  authorizedCents: number; // xAuthAmount
  approved: boolean; // xResult === "A"
  token?: string; // xToken for card-on-file
  errorCode?: string;
  errorMessage?: string;
  raw: unknown;
}

export interface CaptureResult {
  refNum: string;
  capturedCents: number;
  captured: boolean;
  raw: unknown;
}

export interface RefundResult {
  refNum: string;
  refundedCents: number;
  status: "refunded" | "partially_refunded" | "failed";
  raw: unknown;
}

export interface VoidResult {
  refNum: string;
  voided: boolean;
  raw: unknown;
}

export interface TransactionStatus {
  refNum: string;
  status: PaymentStatusValue;
  amountCents: number;
  raw: unknown;
}
