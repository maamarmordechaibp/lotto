import { useLotteries } from "@/hooks/useLotteries";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDollars, formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Lotteries</h2>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> New Lottery
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-40" />)}
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
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline">Edit</Button>
                  <Button size="sm" variant="outline">Clone</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
