import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { callFunction } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import type { DrawingRow } from "@/types/database";

interface DrawResponse {
  drawingId: string;
  ticketNumber: number;
  amountDollars: number;
  winner: { firstName: string; lastName: string; phone: string } | null;
}

/** Public winner archive (drawings are readable by everyone). */
export function useWinners() {
  return useQuery({
    queryKey: ["drawings"],
    queryFn: async (): Promise<DrawingRow[]> => {
      const { data, error } = await supabase
        .from("drawings")
        .select("*")
        .order("drawn_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Admin action: draw a winner via the role-gated Edge Function. */
export function useDrawWinner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (lotteryId: string) =>
      callFunction<DrawResponse>("draw-winner", { lotteryId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["drawings"] });
      qc.invalidateQueries({ queryKey: ["lotteries"] });
    },
  });
}
