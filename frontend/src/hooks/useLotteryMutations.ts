import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { LotteryFormValues } from "@/schemas/entry";
import type { LotteryStatus } from "@/types/database";

function toRow(values: LotteryFormValues) {
  return {
    name: values.name,
    description: values.description ?? null,
    prize_text: values.prizeText ?? null,
    start_date: new Date(values.startDate).toISOString(),
    end_date: new Date(values.endDate).toISOString(),
    drawing_date: values.drawingDate ? new Date(values.drawingDate).toISOString() : null,
    max_participants: values.maxParticipants,
    min_charge: values.minCharge,
    max_charge: values.maxCharge,
  };
}

/** Create / edit / status / soft-delete lotteries (RLS: super_admin | lottery_manager). */
export function useLotteryMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["lotteries"] });
    qc.invalidateQueries({ queryKey: ["lottery"] });
  };

  const create = useMutation({
    mutationFn: async (values: LotteryFormValues & { status?: LotteryStatus }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("lotteries")
        .insert({
          ...toRow(values),
          status: values.status ?? "draft",
          created_by: userRes.user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async (args: { id: string; values: LotteryFormValues & { status?: LotteryStatus } }) => {
      const { error } = await supabase
        .from("lotteries")
        .update({
          ...toRow(args.values),
          ...(args.values.status ? { status: args.values.status } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const setStatus = useMutation({
    mutationFn: async (args: { id: string; status: LotteryStatus }) => {
      const { error } = await supabase
        .from("lotteries")
        .update({ status: args.status, updated_at: new Date().toISOString() })
        .eq("id", args.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lotteries")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, setStatus, softDelete };
}
