import { useWinners } from "@/hooks/useDrawing";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy } from "lucide-react";
import { formatDate, formatDollars } from "@/lib/utils";

export function PastWinnersPage() {
  const { data: winners, isLoading } = useWinners();

  return (
    <div className="container py-12">
      <h1 className="mb-8 flex items-center gap-2 text-3xl font-bold">
        <Trophy className="h-7 w-7 text-amber-500" /> Past Winners
      </h1>
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : winners && winners.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-3">
          {winners.map((w) => (
            <Card key={w.id}>
              <CardHeader>
                <CardTitle>Ticket #{w.winner_ticket_number}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm text-muted-foreground">
                <p>Won {formatDollars(w.amount_cents / 100)} entry</p>
                <p>Drawn {formatDate(w.drawn_at)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No winners have been drawn yet.</p>
      )}
    </div>
  );
}
