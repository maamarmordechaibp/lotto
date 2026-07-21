import { useMutation } from "@tanstack/react-query";
import { callFunction } from "@/lib/api";
import type { EntryFormValues } from "@/schemas/entry";

interface EnterResponse {
  sessionId: string;
  checkoutUrl?: string;
  expiresAt?: string;
}

/**
 * Web entry: asks the backend to create a Sola hosted checkout session.
 * The component then redirects the browser to `checkoutUrl`. Ticket
 * assignment + capture happen server-side after payment success.
 */
export function useEnterLottery() {
  return useMutation({
    mutationFn: async (
      input: EntryFormValues & { lotteryId: string },
    ): Promise<EnterResponse> => {
      return callFunction<EnterResponse>("enter-lottery", {
        lotteryId: input.lotteryId,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        email: input.email || null,
        address: input.address || null,
      });
    },
  });
}
