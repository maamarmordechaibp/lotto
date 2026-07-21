// Hand-authored subset of the generated Supabase types.
// Regenerate the full file with: npm run gen:types
// (supabase gen types typescript --local > src/types/database.ts)

export type LotteryStatus = "draft" | "open" | "paused" | "closed" | "completed";
export type EntryChannel = "phone" | "web";
export type PaymentStatus =
  | "pending"
  | "authorized"
  | "captured"
  | "failed"
  | "voided"
  | "refunded"
  | "partially_refunded";
export type AppRole = "super_admin" | "lottery_manager" | "support" | "viewer";

export interface LotteryRow {
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
  currency: string;
  timezone: string;
  created_at: string;
}

export interface ParticipantRow {
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
  payment_status: PaymentStatus;
  payment_reference: string | null;
  is_flagged: boolean;
  admin_note: string | null;
  created_at: string;
}

export interface PaymentRow {
  id: string;
  participant_id: string | null;
  lottery_id: string;
  gateway: string;
  gateway_reference: string | null;
  status: PaymentStatus;
  authorized_cents: number | null;
  amount_cents: number;
  refunded_cents: number;
  settlement_status: string | null;
  created_at: string;
}

export interface DrawingRow {
  id: string;
  lottery_id: string;
  participant_id: string;
  winner_ticket_number: number;
  amount_cents: number;
  certificate_path: string | null;
  drawn_at: string;
}

export interface UserRoleRow {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface VoicePromptRow {
  id: string;
  lottery_id: string | null;
  slot: string;
  language: string;
  text_content: string | null;
  audio_url: string | null;
}

export interface LotteryStatsResult {
  total_revenue_cents: number;
  total_participants: number;
  remaining_tickets: number;
  average_charge_cents: number;
  highest_charge_cents: number;
  lowest_charge_cents: number;
  phone_count: number;
  web_count: number;
}

function table<Row>() {
  return {} as { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
}

// Minimal Database shape so createClient<Database> is typed.
export interface Database {
  public: {
    Tables: {
      lotteries: ReturnType<typeof table<LotteryRow>>;
      participants: ReturnType<typeof table<ParticipantRow>>;
      payments: ReturnType<typeof table<PaymentRow>>;
      drawings: ReturnType<typeof table<DrawingRow>>;
      user_roles: ReturnType<typeof table<UserRoleRow>>;
      voice_prompts: ReturnType<typeof table<VoicePromptRow>>;
    };
    Views: Record<string, never>;
    Functions: {
      lottery_stats: {
        Args: { p_lottery_id: string };
        Returns: LotteryStatsResult[];
      };
    };
    Enums: {
      lottery_status: LotteryStatus;
      entry_channel: EntryChannel;
      payment_status: PaymentStatus;
      app_role: AppRole;
    };
    CompositeTypes: Record<string, never>;
  };
}
