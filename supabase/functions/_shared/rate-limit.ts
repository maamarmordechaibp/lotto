// ============================================================
// _shared/rate-limit.ts — per-phone / per-IP throttling and
// duplicate-phone detection for a given lottery.
// ============================================================

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const WINDOW_MINUTES = 60;

/** Returns true when the caller is UNDER the limit (allowed to proceed). */
export async function checkRateLimit(
  client: SupabaseClient,
  scope: "phone" | "ip",
  identifier: string,
  lotteryId: string,
  limit: number,
): Promise<boolean> {
  if (limit <= 0) return true;
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();

  const { count } = await client
    .from("rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("scope", scope)
    .eq("identifier", identifier)
    .eq("lottery_id", lotteryId)
    .gte("window_start", since);

  if ((count ?? 0) >= limit) return false;

  await client.from("rate_limits").insert({
    scope, identifier, lottery_id: lotteryId, window_start: new Date().toISOString(),
  });
  return true;
}

/** True when this phone already has a captured entry for the lottery. */
export async function isDuplicatePhone(
  client: SupabaseClient,
  lotteryId: string,
  phone: string,
): Promise<boolean> {
  const { count } = await client
    .from("participants")
    .select("id", { count: "exact", head: true })
    .eq("lottery_id", lotteryId)
    .eq("phone", phone)
    .is("deleted_at", null)
    .eq("payment_status", "captured");
  return (count ?? 0) > 0;
}
