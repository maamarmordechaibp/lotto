import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ShieldCheck } from "lucide-react";
import { entrySchema, type EntryFormValues } from "@/schemas/entry";
import { useLottery } from "@/hooks/useLotteries";
import { useEnterLottery } from "@/hooks/useEnterLottery";
import { useToast } from "@/components/ui/toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiRequestError } from "@/lib/api";
import { formatDollars } from "@/lib/utils";
import {
  IFIELDS_CONFIGURED,
  IFIELD_SRC,
  getIfieldTokens,
  loadIfields,
} from "@/lib/ifields";

export function EnterPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: lottery } = useLottery(id);
  const enter = useEnterLottery();
  const { toast } = useToast();

  const [exp, setExp] = useState("");
  const [zip, setZip] = useState("");
  const [fieldsReady, setFieldsReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EntryFormValues>({ resolver: zodResolver(entrySchema) });

  useEffect(() => {
    if (!IFIELDS_CONFIGURED) return;
    loadIfields()
      .then(() => setFieldsReady(true))
      .catch((err) => toast({ title: "Payment form error", description: err.message, variant: "destructive" }));
  }, [toast]);

  const onSubmit = async (values: EntryFormValues) => {
    if (!id) return;
    if (!/^\d{4}$/.test(exp)) {
      toast({ title: "Invalid expiration", description: "Enter expiration as MMYY.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { cardToken, cvvToken } = await getIfieldTokens();
      if (!cardToken) throw new Error("Please enter your card details.");

      const res = await enter.mutateAsync({
        ...values,
        lotteryId: id,
        cardToken,
        cvvToken,
        exp,
        zip: zip || undefined,
      });

      navigate(`/confirmation?ticket=${res.ticketNumber}&lottery=${id}`);
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : (err as Error).message;
      toast({ title: "Entry could not be completed", description: message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || enter.isPending;

  return (
    <div className="container max-w-lg py-12">
      <Card>
        <CardHeader>
          <CardTitle>Enter {lottery?.name ?? "Lottery"}</CardTitle>
          <CardDescription>
            {lottery && (
              <>
                You'll be charged a random amount between {formatDollars(lottery.min_charge)} and{" "}
                {formatDollars(lottery.max_charge)} — that becomes your ticket number.
              </>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" {...register("firstName")} />
                {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" {...register("lastName")} />
                {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" placeholder="+1 555 555 5555" {...register("phone")} />
              {errors.phone && <p className="text-xs text-destructive">{errors.phone.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email (optional)</Label>
              <Input id="email" type="email" {...register("email")} />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address (optional)</Label>
              <Input id="address" {...register("address")} />
            </div>

            {/* ---- Sola iFields secure card fields ---- */}
            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-medium">Payment</p>
              {IFIELDS_CONFIGURED ? (
                <>
                  <div className="space-y-2">
                    <Label>Card number</Label>
                    <iframe
                      title="Card number"
                      data-ifields-id="card-number"
                      data-ifields-placeholder="Card Number"
                      src={IFIELD_SRC}
                      className="h-10 w-full rounded-md border border-input bg-background"
                    />
                    <input data-ifields-id="card-number-token" name="xCardNum" type="hidden" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="exp">Exp (MMYY)</Label>
                      <Input
                        id="exp"
                        inputMode="numeric"
                        maxLength={4}
                        placeholder="1230"
                        value={exp}
                        onChange={(e) => setExp(e.target.value.replace(/\D/g, ""))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>CVV</Label>
                      <iframe
                        title="CVV"
                        data-ifields-id="cvv"
                        data-ifields-placeholder="CVV"
                        src={IFIELD_SRC}
                        className="h-10 w-full rounded-md border border-input bg-background"
                      />
                      <input data-ifields-id="cvv-token" name="xCVV" type="hidden" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zip">ZIP</Label>
                      <Input
                        id="zip"
                        inputMode="numeric"
                        maxLength={10}
                        value={zip}
                        onChange={(e) => setZip(e.target.value)}
                      />
                    </div>
                  </div>
                  <label data-ifields-id="card-data-error" className="text-xs text-destructive" />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Card payment is not configured. Set <code>VITE_SOLA_IFIELDS_KEY</code> to enable
                  secure card entry, or call {" "}
                  <a href="tel:+18459357587" className="underline">+1 (845) 935-7587</a> to enter by phone.
                </p>
              )}
            </div>

            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" {...register("acceptTerms")} />
              <span>I accept the terms and understand the random charge model.</span>
            </label>
            {errors.acceptTerms && <p className="text-xs text-destructive">{errors.acceptTerms.message}</p>}

            <Button
              type="submit"
              className="w-full"
              disabled={busy || (IFIELDS_CONFIGURED && !fieldsReady)}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Pay & get my ticket
            </Button>
            <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> Card data is tokenized by Sola — it never touches our servers.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
