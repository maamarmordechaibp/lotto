import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { LotteryRow } from "@/types/database";

/** All publicly visible lotteries (open/paused/closed/completed). */
export function useLotteries(statuses: string[] = ["open"]) {
  return useQuery({
    queryKey: ["lotteries", statuses],
    queryFn: async (): Promise<LotteryRow[]> => {
      const { data, error } = await supabase
        .from("lotteries")
        .select("*")
        .in("status", statuses)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLottery(id: string | undefined) {
  return useQuery({
    queryKey: ["lottery", id],
    enabled: Boolean(id),
    queryFn: async (): Promise<LotteryRow> => {
      const { data, error } = await supabase
        .from("lotteries")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}
