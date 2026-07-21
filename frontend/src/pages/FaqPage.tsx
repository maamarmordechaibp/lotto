import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FAQS = [
  {
    q: "How is my ticket number decided?",
    a: "When you enter, our backend randomly selects an unused whole-dollar amount within the lottery's range. That number is your ticket, and it's also the exact amount you're charged.",
  },
  {
    q: "Can I choose my ticket number?",
    a: "No. Numbers are assigned randomly and are guaranteed unique per lottery to keep things fair.",
  },
  {
    q: "How do I enter by phone?",
    a: "Call +1 (845) 935-7587. Our voice system walks you through entry and secure payment. Your ticket is read back to you and sent by SMS.",
  },
  {
    q: "Is my card information safe?",
    a: "Yes. Payments are handled by Sola Payments on a PCI-compliant hosted page or IVR. We never see or store raw card data.",
  },
  {
    q: "What happens if the lottery sells out during my entry?",
    a: "If no ticket can be assigned, your card authorization is voided and you are not charged.",
  },
];

export function FaqPage() {
  return (
    <div className="container max-w-3xl py-12">
      <h1 className="mb-8 text-3xl font-bold">Frequently Asked Questions</h1>
      <div className="space-y-4">
        {FAQS.map((f) => (
          <Card key={f.q}>
            <CardHeader><CardTitle className="text-base">{f.q}</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">{f.a}</CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
