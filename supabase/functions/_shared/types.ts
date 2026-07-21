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

// -------- PaymentGateway domain types --------
export interface PaymentSessionParams {
  lotteryId: string;
  minAmountCents: number;
  maxAmountCents: number;
  customerPhone: string;
  customerEmail?: string | null;
  customerName: string;
  channel: EntryChannel;
  returnUrl?: string;
  metadata?: Record<string, string>;
}

export interface PaymentSession {
  sessionId: string;
  hostedUrl?: string; // web hosted checkout
  expiresAt?: string;
  raw: unknown;
}

export interface AuthResult {
  authId: string;
  authorizedCents: number;
  status: "authorized" | "declined";
  raw: unknown;
}

export interface CaptureResult {
  transactionId: string;
  capturedCents: number;
  status: "captured" | "failed";
  raw: unknown;
}

export interface RefundResult {
  refundId: string;
  refundedCents: number;
  status: "refunded" | "partially_refunded" | "failed";
  raw: unknown;
}

export interface VoidResult {
  authId: string;
  status: "voided" | "failed";
  raw: unknown;
}

export interface TransactionStatus {
  transactionId: string;
  status: PaymentStatusValue;
  amountCents: number;
  settlementStatus?: string;
  raw: unknown;
}
