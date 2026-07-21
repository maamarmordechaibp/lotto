import { useParams, Link } from "react-router-dom";
import { Phone } from "lucide-react";
import { useLottery } from "@/hooks/useLotteries";
import { useLotteryStats } from "@/hooks/useLotteryStats";
import { useRealtime } from "@/hooks/useRealtime";
import { Countdown } from "@/components/Countdown";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDollars, formatDate } from "@/lib/utils";

export function LotteryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: lottery, isLoading } = useLottery(id);
  const { data: stats } = useLotteryStats(id);
  useRealtime(id);

  if (isLoading) return <div className="container py-16"><Skeleton className="h-96 w-full" /></div>;
  if (!lottery) return <div className="container py-16">Lottery not found.</div>;

  const sold = stats ? Number(stats.total_participants) : 0;
  const range = lottery.max_charge - lottery.min_charge + 1;
  const remaining = stats ? Number(stats.remaining_tickets) : range;
  const pct = Math.round((sold / range) * 100);

  return (
    <div className="container grid gap-10 py-12 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        {lottery.prize_image_url && (
          <img
            src={lottery.prize_image_url}
            alt={lottery.prize_text ?? lottery.name}
            className="aspect-video w-full rounded-lg object-cover"
          />
        )}
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{lottery.name}</h1>
          <Badge variant={lottery.status === "open" ? "success" : "secondary"}>
            {lottery.status}
          </Badge>
        </div>
        <p className="text-muted-foreground">{lottery.description}</p>

        <Card>
          <CardHeader><CardTitle>How it works</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              We charge a randomly selected whole-dollar amount between{" "}
              <strong className="text-foreground">{formatDollars(lottery.min_charge)}</strong> and{" "}
              <strong className="text-foreground">{formatDollars(lottery.max_charge)}</strong>.
            </p>
            <p>That exact amount becomes your unique ticket number. Ticket #247 → charged $247.</p>
          </CardContent>
        </Card>
      </div>

      <aside className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Prize</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-lg font-medium">{lottery.prize_text}</p>
            <div>
              <p className="mb-1 text-sm text-muted-foreground">Drawing date</p>
              {lottery.drawing_date && <Countdown target={lottery.drawing_date} />}
              <p className="mt-2 text-sm text-muted-foreground">{formatDate(lottery.drawing_date)}</p>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <span>{sold} entered</span>
                <span>{remaining} left</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
            {lottery.status === "open" ? (
              <div className="space-y-2">
                <Link to={`/enter/${lottery.id}`}>
                  <Button className="w-full">Enter Online</Button>
                </Link>
                <a href="tel:+18459357587">
                  <Button variant="outline" className="w-full gap-2">
                    <Phone className="h-4 w-4" /> Enter by Phone
                  </Button>
                </a>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">This lottery is not accepting entries.</p>
            )}
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
