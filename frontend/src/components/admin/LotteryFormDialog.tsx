import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { lotterySchema, type LotteryFormValues } from "@/schemas/entry";
import { useLotteryMutations } from "@/hooks/useLotteryMutations";
import { useToast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { LotteryRow, LotteryStatus } from "@/types/database";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lottery?: LotteryRow | null;
}

function toLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function LotteryFormDialog({ open, onOpenChange, lottery }: Props) {
  const isEdit = Boolean(lottery);
  const { create, update } = useLotteryMutations();
  const { toast } = useToast();
  const [status, setStatus] = useState<LotteryStatus>(lottery?.status ?? "draft");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LotteryFormValues>({
    resolver: zodResolver(lotterySchema),
    defaultValues: lottery
      ? {
          name: lottery.name,
          description: lottery.description ?? "",
          prizeText: lottery.prize_text ?? "",
          startDate: toLocal(lottery.start_date),
          endDate: toLocal(lottery.end_date),
          drawingDate: toLocal(lottery.drawing_date),
          maxParticipants: lottery.max_participants,
          minCharge: lottery.min_charge,
          maxCharge: lottery.max_charge,
        }
      : { minCharge: 1, maxCharge: 500, maxParticipants: 500 },
  });

  const onSubmit = async (values: LotteryFormValues) => {
    try {
      if (isEdit && lottery) {
        await update.mutateAsync({ id: lottery.id, values: { ...values, status } });
      } else {
        await create.mutateAsync({ ...values, status });
      }
      toast({ title: isEdit ? "Lottery updated" : "Lottery created", variant: "success" });
      onOpenChange(false);
    } catch (err) {
      toast({ title: "Save failed", description: (err as Error).message, variant: "destructive" });
    }
  };

  const busy = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Lottery" : "New Lottery"}</DialogTitle>
          <DialogDescription>
            The charge range is also the ticket-number range — each entrant is charged a random
            unused amount that becomes their ticket.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              rows={2}
              className="w-full rounded-md border border-input bg-background p-2 text-sm"
              {...register("description")}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="prizeText">Prize</Label>
            <Input id="prizeText" {...register("prizeText")} />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="maxParticipants">Max participants</Label>
              <Input id="maxParticipants" type="number" {...register("maxParticipants", { valueAsNumber: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minCharge">Min charge $</Label>
              <Input id="minCharge" type="number" {...register("minCharge", { valueAsNumber: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxCharge">Max charge $</Label>
              <Input id="maxCharge" type="number" {...register("maxCharge", { valueAsNumber: true })} />
              {errors.maxCharge && <p className="text-xs text-destructive">{errors.maxCharge.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="startDate">Start</Label>
              <Input id="startDate" type="datetime-local" {...register("startDate")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">End</Label>
              <Input id="endDate" type="datetime-local" {...register("endDate")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="drawingDate">Drawing</Label>
              <Input id="drawingDate" type="datetime-local" {...register("drawingDate")} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value as LotteryStatus)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {["draft", "open", "paused", "closed", "completed"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Create lottery"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
