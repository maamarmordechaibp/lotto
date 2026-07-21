import { useState } from "react";
import { Mail, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";

export function ContactPage() {
  const { toast } = useToast();
  const [sent, setSent] = useState(false);

  return (
    <div className="container max-w-2xl py-12">
      <h1 className="mb-2 text-3xl font-bold">Contact Us</h1>
      <p className="mb-8 text-muted-foreground">
        Questions about an entry or a drawing? Reach out and we'll respond quickly.
      </p>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Get in touch</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="flex items-center gap-2"><Phone className="h-4 w-4" /> +1 (845) 935-7587</p>
            <p className="flex items-center gap-2"><Mail className="h-4 w-4" /> support@luckyline.test</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Send a message</CardTitle></CardHeader>
          <CardContent>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                setSent(true);
                toast({ title: "Message sent", description: "We'll be in touch soon.", variant: "success" });
              }}
            >
              <div className="space-y-1">
                <Label htmlFor="name">Name</Label>
                <Input id="name" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="message">Message</Label>
                <textarea
                  id="message"
                  required
                  rows={4}
                  className="w-full rounded-md border border-input bg-background p-2 text-sm"
                />
              </div>
              <Button type="submit" className="w-full" disabled={sent}>
                {sent ? "Sent" : "Send message"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
