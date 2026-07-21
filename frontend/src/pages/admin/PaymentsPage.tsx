import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { callFunction, ApiRequestError } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { formatCents, formatDate } from "@/lib/utils";
import type { PaymentRow } from "@/types/database";

function usePayments() {
  return useQuery({
    queryKey: ["payments"],
    queryFn: async (): Promise<PaymentRow[]> => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function PaymentsPage() {
  const { data: payments, isLoading } = usePayments();
  const qc = useQueryClient();
  const { toast } = useToast();

  const refund = async (id: string) => {
    try {
      await callFunction("refund-payment", { paymentId: id });
      toast({ title: "Refund issued", variant: "success" });
      qc.invalidateQueries({ queryKey: ["payments"] });
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : "Refund failed";
      toast({ title: "Refund failed", description: message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Payments</h2>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  {["Gateway Ref", "Amount", "Refunded", "Status", "Settlement", "Date", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b">
                      <td colSpan={7} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td>
                    </tr>
                  ))
                ) : payments && payments.length ? (
                  payments.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-muted/30">
                      <td className="px-4 py-3 font-mono text-xs">{p.gateway_reference ?? "—"}</td>
                      <td className="px-4 py-3">{formatCents(p.amount_cents)}</td>
                      <td className="px-4 py-3">{formatCents(p.refunded_cents)}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={
                            p.status === "captured" ? "success"
                            : p.status === "failed" ? "destructive"
                            : "secondary"
                          }
                        >
                          {p.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">{p.settlement_status ?? "—"}</td>
                      <td className="px-4 py-3">{formatDate(p.created_at)}</td>
                      <td className="px-4 py-3">
                        {(p.status === "captured" || p.status === "partially_refunded") && (
                          <Button size="sm" variant="outline" onClick={() => refund(p.id)}>
                            Refund
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No payments recorded.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
