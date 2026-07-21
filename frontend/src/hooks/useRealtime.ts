import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * Subscribe to Supabase Realtime and invalidate relevant queries on change.
 * No polling — pure websocket. Used by the admin dashboard and public
 * lottery pages (live participant counter).
 */
export function useRealtime(lotteryId?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel(`realtime-${lotteryId ?? "global"}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "participants" }, () => {
        qc.invalidateQueries({ queryKey: ["participants"] });
        qc.invalidateQueries({ queryKey: ["lottery-stats"] });
        qc.invalidateQueries({ queryKey: ["recent-registrations"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "payments" }, () => {
        qc.invalidateQueries({ queryKey: ["payments"] });
        qc.invalidateQueries({ queryKey: ["lottery-stats"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "lotteries" }, () => {
        qc.invalidateQueries({ queryKey: ["lotteries"] });
        qc.invalidateQueries({ queryKey: ["lottery"] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "drawings" }, () => {
        qc.invalidateQueries({ queryKey: ["drawings"] });
        qc.invalidateQueries({ queryKey: ["lottery"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc, lotteryId]);
}
