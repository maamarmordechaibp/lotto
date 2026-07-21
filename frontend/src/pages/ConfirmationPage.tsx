import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, Ticket } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ConfirmationPage() {
  const [params] = useSearchParams();
  const ticket = params.get("ticket");

  return (
    <div className="container flex max-w-lg flex-col items-center py-16 text-center">
      <CheckCircle2 className="h-16 w-16 text-emerald-500" />
      <h1 className="mt-4 text-3xl font-bold">Entry Confirmed!</h1>
      <p className="mt-2 text-muted-foreground">
        Your payment was processed and your ticket is secured. A confirmation SMS
        {ticket ? " and email are" : " is"} on its way.
      </p>

      {ticket && (
        <Card className="mt-8 w-full">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <Ticket className="h-5 w-5 text-primary" /> Your Ticket
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-extrabold text-primary">#{ticket}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              You were charged ${ticket}. Good luck!
            </p>
          </CardContent>
        </Card>
      )}

      <Link to="/" className="mt-8">
        <Button variant="outline">Back to Home</Button>
      </Link>
    </div>
  );
}
