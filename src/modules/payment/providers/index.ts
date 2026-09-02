import { PaymentProvider } from "@prisma/client";
import { ApiError } from "../../../utils/ApiError";
import { PaymentProviderAdapter } from "./types";
import { stripeProvider } from "./stripe.provider";
import { sslcommerzProvider } from "./sslcommerz.provider";

const registry: Partial<Record<PaymentProvider, PaymentProviderAdapter>> = {
  [PaymentProvider.STRIPE]: stripeProvider,
  [PaymentProvider.SSLCOMMERZ]: sslcommerzProvider,
  // BKASH: implement `PaymentProviderAdapter` following bKash's tokenized
  // checkout flow (grant token -> create payment -> execute on callback)
  // and register it here. Left out of this pass — Stripe and SSLCommerz
  // are the two fully working, real gateways for now.
};

export function getPaymentProvider(provider: PaymentProvider): PaymentProviderAdapter {
  const adapter = registry[provider];
  if (!adapter) {
    throw ApiError.badRequest(`Payment provider ${provider} is not available yet`);
  }
  return adapter;
}
