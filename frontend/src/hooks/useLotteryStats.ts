import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface LotteryStats {
  total_revenue_cents: number;
  total_participants: number;
  remaining_tickets: number;
  average_charge_cents: number;
  highest_charge_cents: number;
  lowest_charge_cents: number;
  phone_count: number;
  web_count: number;
}

/** Aggregate dashboard metrics for a lottery via the lottery_stats() RPC. */
export function useLotteryStats(lotteryId: string | undefined) {
  return useQuery({
    queryKey: ["lottery-stats", lotteryId],
    enabled: Boolean(lotteryId),
    queryFn: async (): Promise<LotteryStats> => {
      const { data, error } = await supabase
        .rpc("lottery_stats", { p_lottery_id: lotteryId! })
        .single();
      if (error) throw error;
      return data as unknown as LotteryStats;
    },
  });
}
