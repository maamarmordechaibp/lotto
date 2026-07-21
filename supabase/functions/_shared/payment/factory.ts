// ============================================================
// _shared/payment/factory.ts
// Single place that binds the concrete gateway. Swap providers
// here — business logic depends only on the PaymentGateway type.
// ============================================================

import type { PaymentGateway } from "./gateway.ts";
import { SolaPaymentsGateway } from "./sola.ts";

let instance: PaymentGateway | null = null;

/** Returns the configured default payment gateway (Sola). */
export function getPaymentGateway(): PaymentGateway {
  if (!instance) {
    instance = new SolaPaymentsGateway();
  }
  return instance;
}
