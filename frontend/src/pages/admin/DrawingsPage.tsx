import { useWinners } from "@/hooks/useDrawing";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCents, formatDate } from "@/lib/utils";

export function DrawingsPage() {
  const { data: drawings, isLoading } = useWinners();

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Drawings</h2>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                {["Winning Ticket", "Amount", "Drawn At", "Certificate"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={4} className="px-4 py-3"><Skeleton className="h-5 w-full" /></td></tr>
              ) : drawings && drawings.length ? (
                drawings.map((d) => (
                  <tr key={d.id} className="border-b">
                    <td className="px-4 py-3 font-semibold">#{d.winner_ticket_number}</td>
                    <td className="px-4 py-3">{formatCents(d.amount_cents)}</td>
                    <td className="px-4 py-3">{formatDate(d.drawn_at)}</td>
                    <td className="px-4 py-3">
                      {d.certificate_path ? "Available" : "—"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No drawings yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
