export interface CreateSessionInput {
  transactionId: string;
  amount: number;
  currency: string; // ISO 4217, e.g. "BDT", "USD"
  purpose: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  ipnUrl?: string;
}

export interface CreateSessionResult {
  /** URL to redirect the payer to (Stripe Checkout / SSLCommerz gateway page). */
  redirectUrl?: string;
  /** The provider's own reference for this session (session id / sess_id). */
  providerReference: string;
  raw: unknown;
}

export interface PaymentProviderAdapter {
  createSession(input: CreateSessionInput): Promise<CreateSessionResult>;
}

export type NormalizedStatus = "SUCCESS" | "FAILED" | "CANCELLED";
