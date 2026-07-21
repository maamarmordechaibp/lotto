import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { ParticipantRow } from "@/types/database";

export interface ParticipantsFilters {
  lotteryId?: string;
  search?: string;
  channel?: string;
  paymentStatus?: string;
  page: number;
  pageSize: number;
  sortBy?: keyof ParticipantRow;
  sortAsc?: boolean;
}

export interface ParticipantsPage {
  rows: ParticipantRow[];
  total: number;
}

/** Admin participants table — server-side pagination, sort, filter, search. */
export function useParticipants(filters: ParticipantsFilters) {
  return useQuery({
    queryKey: ["participants", filters],
    queryFn: async (): Promise<ParticipantsPage> => {
      const from = filters.page * filters.pageSize;
      const to = from + filters.pageSize - 1;

      let query = supabase
        .from("participants")
        .select("*", { count: "exact" })
        .is("deleted_at", null)
        .range(from, to)
        .order(filters.sortBy ?? "created_at", { ascending: filters.sortAsc ?? false });

      if (filters.lotteryId) query = query.eq("lottery_id", filters.lotteryId);
      if (filters.channel) query = query.eq("channel", filters.channel);
      if (filters.paymentStatus) query = query.eq("payment_status", filters.paymentStatus);
      if (filters.search) {
        const s = `%${filters.search}%`;
        query = query.or(
          `first_name.ilike.${s},last_name.ilike.${s},phone.ilike.${s},email.ilike.${s}`,
        );
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: data ?? [], total: count ?? 0 };
    },
    placeholderData: (prev) => prev,
  });
}
