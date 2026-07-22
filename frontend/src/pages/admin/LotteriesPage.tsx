import { useState } from "react";
import { Plus, Pencil, Play, Pause, Trophy } from "lucide-react";
import { useLotteries } from "@/hooks/useLotteries";
import { useLotteryMutations } from "@/hooks/useLotteryMutations";
import { useDrawWinner } from "@/hooks/useDrawing";
import { LotteryFormDialog } from "@/components/admin/LotteryFormDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { ApiRequestError } from "@/lib/api";
import { formatDollars, formatDate } from "@/lib/utils";
import type { LotteryRow } from "@/types/database";

const STATUS_VARIANT: Record<string, "success" | "secondary" | "warning" | "destructive"> = {
  open: "success",
  paused: "warning",
  closed: "secondary",
  completed: "secondary",
  draft: "secondary",
};

export function LotteriesPage() {
  const { data: lotteries, isLoading } = useLotteries([
    "draft",
    "open",
    "paused",
    "closed",
    "completed",
  ]);
  const { setStatus } = useLotteryMutations();
  const draw = useDrawWinner();
  const { toast } = useToast();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<LotteryRow | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (l: LotteryRow) => {
    setEditing(l);
    setDialogOpen(true);
  };

  const changeStatus = async (id: string, status: "open" | "paused" | "closed") => {
    try {
      await setStatus.mutateAsync({ id, status });
      toast({ title: `Lottery ${status}`, variant: "success" });
    } catch (err) {
      toast({ title: "Update failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const drawWinner = async (id: string) => {
    try {
      const res = await draw.mutateAsync(id);
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Lotteries</h2>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" /> New Lottery
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-44" />)}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {lotteries?.map((l) => (
            <Card key={l.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-base">{l.name}</CardTitle>
                <Badge variant={STATUS_VARIANT[l.status] ?? "secondary"}>{l.status}</Badge>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p>Range: {formatDollars(l.min_charge)}–{formatDollars(l.max_charge)}</p>
                <p>Max participants: {l.max_participants}</p>
                <p>Drawing: {formatDate(l.drawing_date)}</p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => openEdit(l)}>
                    <Pencil className="h-3 w-3" /> Edit
                  </Button>
                  {l.status !== "open" && l.status !== "completed" && (
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => changeStatus(l.id, "open")}>
                      <Play className="h-3 w-3" /> Open
                    </Button>
                  )}
                  {l.status === "open" && (
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => changeStatus(l.id, "paused")}>
                      <Pause className="h-3 w-3" /> Pause
                    </Button>
                  )}
                  {(l.status === "open" || l.status === "paused" || l.status === "closed") && (
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => drawWinner(l.id)}>
                      <Trophy className="h-3 w-3" /> Draw
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
          {lotteries && lotteries.length === 0 && (
            <p className="text-muted-foreground">No lotteries yet. Create your first one.</p>
          )}
        </div>
      )}

      <LotteryFormDialog open={dialogOpen} onOpenChange={setDialogOpen} lottery={editing} />
    </div>
  );
}
