import Stripe from "stripe";
import { env } from "../../../config/env";
import { ApiError } from "../../../utils/ApiError";
import { CreateSessionInput, CreateSessionResult, NormalizedStatus, PaymentProviderAdapter } from "./types";

let stripeClient: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!env.payment.stripe.secretKey) {
    throw ApiError.internal("Stripe is not configured (STRIPE_SECRET_KEY missing)");
  }
  if (!stripeClient) {
    stripeClient = new Stripe(env.payment.stripe.secretKey, { apiVersion: "2024-06-20" });
  }
  return stripeClient;
}

export const stripeProvider: PaymentProviderAdapter = {
  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    const stripe = getStripeClient();

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: input.customerEmail,
      client_reference_id: input.transactionId,
      line_items: [
        {
          price_data: {
            currency: input.currency.toLowerCase(),
            product_data: {
              name: `Blood Donation Platform — ${input.purpose.replace(/_/g, " ")}`,
            },
            unit_amount: Math.round(input.amount * 100), // Stripe expects the smallest currency unit
          },
          quantity: 1,
        },
      ],
      success_url: `${input.successUrl}?transactionId=${input.transactionId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${input.cancelUrl}?transactionId=${input.transactionId}`,
      metadata: { transactionId: input.transactionId, purpose: input.purpose },
    });

    return {
      redirectUrl: session.url ?? undefined,
      providerReference: session.id,
      raw: session,
    };
  },
};

/**
 * Verifies the Stripe webhook signature against the RAW request body and
 * normalizes the event into { transactionId, status, raw }. Throws ApiError
 * if the signature doesn't match (protects against forged webhook calls).
 */
export function verifyStripeWebhook(
  rawBody: Buffer,
  signatureHeader: string | string[] | undefined
): { transactionId: string; status: NormalizedStatus; raw: unknown } | null {
  const stripe = getStripeClient();

  if (!signatureHeader || Array.isArray(signatureHeader)) {
    throw ApiError.badRequest("Missing Stripe signature header");
  }
  if (!env.payment.stripe.webhookSecret) {
    throw ApiError.internal("Stripe webhook secret is not configured");
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signatureHeader, env.payment.stripe.webhookSecret);
  } catch (err) {
    throw ApiError.badRequest(`Stripe webhook signature verification failed: ${(err as Error).message}`);
  }

  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      const transactionId = session.metadata?.transactionId ?? session.client_reference_id;
      if (!transactionId) return null;
      return { transactionId, status: "SUCCESS", raw: event };
    }
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const transactionId = session.metadata?.transactionId ?? session.client_reference_id;
      if (!transactionId) return null;
      return { transactionId, status: "FAILED", raw: event };
    }
    default:
      // Event type we don't act on (e.g. payment_intent.created) — ignore.
      return null;
  }
}
