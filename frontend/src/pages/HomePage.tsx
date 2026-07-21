import { Link } from "react-router-dom";
import { Phone, Sparkles, ArrowRight } from "lucide-react";
import { useLotteries } from "@/hooks/useLotteries";
import { useRealtime } from "@/hooks/useRealtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDollars, formatDate } from "@/lib/utils";

export function HomePage() {
  const { data: lotteries, isLoading } = useLotteries(["open"]);
  useRealtime();

  return (
    <>
      <section className="border-b bg-gradient-to-b from-primary/10 to-background">
        <div className="container flex flex-col items-center py-20 text-center">
          <Badge variant="secondary" className="mb-4">
            <Sparkles className="mr-1 h-3 w-3" /> Voice-first entry
          </Badge>
          <h1 className="max-w-3xl text-4xl font-extrabold tracking-tight sm:text-6xl">
            Your charge is your ticket number
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Enter by phone or online. We charge a random amount within the range —
            and that exact amount becomes your ticket number. Simple, fair, transparent.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="tel:+18459357587">
              <Button size="lg" className="gap-2">
                <Phone className="h-5 w-5" /> Call +1 (845) 935-7587
              </Button>
            </a>
            <a href="#active">
              <Button size="lg" variant="outline" className="gap-2">
                Browse lotteries <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      <section id="active" className="container py-16">
        <h2 className="mb-8 text-2xl font-bold">Active Lotteries</h2>
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        ) : lotteries && lotteries.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {lotteries.map((l) => (
              <Card key={l.id} className="flex flex-col">
                {l.prize_image_url && (
                  <img
                    src={l.prize_image_url}
                    alt={l.prize_text ?? l.name}
                    className="h-40 w-full rounded-t-lg object-cover"
                  />
                )}
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{l.name}</CardTitle>
                    <Badge variant="success">Open</Badge>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-4">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p className="line-clamp-2">{l.description}</p>
                    <p>Prize: <span className="font-medium text-foreground">{l.prize_text}</span></p>
                    <p>
                      Charge range:{" "}
                      <span className="font-medium text-foreground">
                        {formatDollars(l.min_charge)}–{formatDollars(l.max_charge)}
                      </span>
                    </p>
                    <p>Drawing: {formatDate(l.drawing_date)}</p>
                  </div>
                  <Link to={`/lottery/${l.id}`}>
                    <Button className="w-full">View & Enter</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No active lotteries right now. Check back soon!</p>
        )}
      </section>
    </>
  );
}
