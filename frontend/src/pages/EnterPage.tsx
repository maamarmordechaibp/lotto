import { useParams } from "react-router-dom";
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

export function EnterPage() {
  const { id } = useParams<{ id: string }>();
  const { data: lottery } = useLottery(id);
  const enter = useEnterLottery();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EntryFormValues>({ resolver: zodResolver(entrySchema) });

  const onSubmit = async (values: EntryFormValues) => {
    if (!id) return;
    try {
      const res = await enter.mutateAsync({ ...values, lotteryId: id });
      if (res.checkoutUrl) {
        // Redirect to Sola's PCI-compliant hosted checkout.
        window.location.href = res.checkoutUrl;
      } else {
        toast({ title: "Entry started", description: "Complete payment to receive your ticket." });
      }
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.message : "Something went wrong";
      toast({ title: "Could not start entry", description: message, variant: "destructive" });
    }
  };

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
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" {...register("acceptTerms")} />
              <span>I accept the terms and understand the random charge model.</span>
            </label>
            {errors.acceptTerms && <p className="text-xs text-destructive">{errors.acceptTerms.message}</p>}

            <Button type="submit" className="w-full" disabled={enter.isPending}>
              {enter.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Continue to secure payment
            </Button>
            <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-3 w-3" /> PCI-compliant checkout by Sola Payments
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
