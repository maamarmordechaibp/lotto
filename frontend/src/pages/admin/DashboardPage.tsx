import { useState } from "react";
import {
  DollarSign,
  Users,
  Ticket,
  TrendingUp,
  Activity,
  Trophy,
  Loader2,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLotteries } from "@/hooks/useLotteries";
import { useLotteryStats } from "@/hooks/useLotteryStats";
import { useRealtime } from "@/hooks/useRealtime";
import { useDrawWinner } from "@/hooks/useDrawing";
import { supabase } from "@/lib/supabase";
import { StatCard } from "@/components/admin/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { ApiRequestError } from "@/lib/api";
import { formatCents, formatDollars } from "@/lib/utils";
import type { ParticipantRow } from "@/types/database";

function useRecentRegistrations(lotteryId?: string) {
  return useQuery({
    queryKey: ["recent-registrations", lotteryId],
    queryFn: async (): Promise<ParticipantRow[]> => {
      let q = supabase
        .from("participants")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(8);
      if (lotteryId) q = q.eq("lottery_id", lotteryId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function DashboardPage() {
  const { data: lotteries } = useLotteries(["open", "paused", "closed", "completed"]);
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const activeId = selectedId ?? lotteries?.[0]?.id;
  const { data: stats, isLoading } = useLotteryStats(activeId);
  const { data: recent } = useRecentRegistrations(activeId);
  const draw = useDrawWinner();
  const { toast } = useToast();
  useRealtime(activeId);

  const selected = lotteries?.find((l) => l.id === activeId);
  const openCount = lotteries?.filter((l) => l.status === "open").length ?? 0;
  const closedCount = lotteries?.filter((l) => ["closed", "completed"].includes(l.status)).length ?? 0;

  const handleDraw = async () => {
    if (!activeId) return;
    try {
      const res = await draw.mutateAsync(activeId);
      toast({
        title: `Winner: Ticket #${res.ticketNumber}`,
        description: res.winner ? `${res.winner.firstName} ${res.winner.lastName}` : undefined,
        variant: "success",
      });
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : "Draw failed";
      toast({ title: "Could not draw winner", description: message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Overview</h2>
          <p className="text-sm text-muted-foreground">Live metrics update automatically.</p>
        </div>
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={activeId ?? ""}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {lotteries?.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name} ({l.status})
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={stats ? formatCents(Number(stats.total_revenue_cents)) : undefined}
          icon={DollarSign}
          loading={isLoading}
        />
        <StatCard
          title="Participants"
          value={stats ? Number(stats.total_participants) : undefined}
          icon={Users}
          loading={isLoading}
        />
        <StatCard
          title="Remaining Tickets"
          value={stats ? Number(stats.remaining_tickets) : undefined}
          icon={Ticket}
          loading={isLoading}
        />
        <StatCard
          title="Average Charge"
          value={stats ? formatCents(Number(stats.average_charge_cents)) : undefined}
          icon={TrendingUp}
          loading={isLoading}
        />
        <StatCard
          title="Highest Charge"
          value={stats ? formatCents(Number(stats.highest_charge_cents)) : undefined}
          icon={TrendingUp}
          loading={isLoading}
        />
        <StatCard
          title="Lowest Charge"
          value={stats ? formatCents(Number(stats.lowest_charge_cents)) : undefined}
          icon={TrendingUp}
          loading={isLoading}
        />
        <StatCard title="Open Lotteries" value={openCount} icon={Activity} />
        <StatCard title="Closed Lotteries" value={closedCount} icon={Activity} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Registrations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {recent && recent.length > 0 ? (
                recent.map((p) => (
                  <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                    <div>
                      <span className="font-medium">
                        {p.first_name} {p.last_name}
                      </span>
                      <span className="ml-2 text-muted-foreground">
                        Ticket #{p.ticket_number}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={p.channel === "phone" ? "secondary" : "outline"}>
                        {p.channel}
                      </Badge>
                      <span className="font-medium">{formatDollars(p.ticket_number)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">No registrations yet.</p>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Drawing</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Draw a random winner from sold tickets for{" "}
                <strong className="text-foreground">{selected?.name}</strong>.
              </p>
              <Button
                onClick={handleDraw}
                disabled={draw.isPending || !activeId}
                className="w-full gap-2"
              >
                {draw.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />}
                Draw Winner
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>System Health</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              {["Supabase", "SignalWire", "Sola Payments"].map((s) => (
                <div key={s} className="flex items-center justify-between">
                  <span>{s}</span>
                  <Badge variant="success">Operational</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
