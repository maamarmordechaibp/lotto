import { useMutation } from "@tanstack/react-query";
import { callFunction } from "@/lib/api";
import type { EntryFormValues } from "@/schemas/entry";

interface EnterResponse {
  ticketNumber: number;
  amountDollars: number;
  refNum: string;
}

export interface EnterPayload extends EntryFormValues {
  lotteryId: string;
  cardToken: string; // iFields SUT for xCardNum
  cvvToken?: string; // iFields SUT for xCVV
  exp: string; // MMYY
  zip?: string;
}

/**
 * Web entry: submits iFields single-use tokens + entrant info to the
 * backend, which authorizes, assigns a ticket, and captures the exact
 * amount synchronously (no webhook). Returns the assigned ticket number.
 */
export function useEnterLottery() {
  return useMutation({
    mutationFn: async (input: EnterPayload): Promise<EnterResponse> => {
      return callFunction<EnterResponse>("enter-lottery", {
        lotteryId: input.lotteryId,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        email: input.email || null,
        address: input.address || null,
        cardToken: input.cardToken,
        cvvToken: input.cvvToken,
        exp: input.exp,
        zip: input.zip,
      });
    },
  });
}
