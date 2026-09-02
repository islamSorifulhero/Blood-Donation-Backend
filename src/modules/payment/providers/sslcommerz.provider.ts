import axios from "axios";
import { env } from "../../../config/env";
import { ApiError } from "../../../utils/ApiError";
import { CreateSessionInput, CreateSessionResult, PaymentProviderAdapter } from "./types";

const BASE_URL = env.payment.sslcommerz.isLive
  ? "https://securepay.sslcommerz.com"
  : "https://sandbox.sslcommerz.com";

export const sslcommerzProvider: PaymentProviderAdapter = {
  async createSession(input: CreateSessionInput): Promise<CreateSessionResult> {
    if (!env.payment.sslcommerz.storeId || !env.payment.sslcommerz.storePassword) {
      throw ApiError.internal("SSLCommerz is not configured (SSLCOMMERZ_STORE_ID / STORE_PASSWORD missing)");
    }

    const payload = {
      store_id: env.payment.sslcommerz.storeId,
      store_passwd: env.payment.sslcommerz.storePassword,
      total_amount: input.amount,
      currency: input.currency,
      tran_id: input.transactionId,
      success_url: input.successUrl,
      fail_url: input.failUrl,
      cancel_url: input.cancelUrl,
      ipn_url: input.ipnUrl,
      shipping_method: "NO",
      product_name: input.purpose,
      product_category: "Service",
      product_profile: "general",
      cus_name: input.customerName,
      cus_email: input.customerEmail,
      cus_add1: "N/A",
      cus_city: "Dhaka",
      cus_postcode: "1000",
      cus_country: "Bangladesh",
      cus_phone: input.customerPhone || "01700000000",
    };

    const { data } = await axios.post(`${BASE_URL}/gwprocess/v4/api.php`, new URLSearchParams(payload as never), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    if (data.status !== "SUCCESS" || !data.GatewayPageURL) {
      throw ApiError.internal(`SSLCommerz session initiation failed: ${data.failedreason ?? "unknown error"}`);
    }

    return {
      redirectUrl: data.GatewayPageURL,
      providerReference: data.sessionkey,
      raw: data,
    };
  },
};

/**
 * SSLCommerz posts the callback body directly from the payer's browser, which
 * is NOT trustworthy on its own — it must be re-validated server-to-server
 * against SSLCommerz's Validation API before being treated as authoritative.
 */
export async function validateSslcommerzTransaction(valId: string): Promise<{
  isValid: boolean;
  transactionId: string;
  amount: number;
  raw: unknown;
}> {
  const { data } = await axios.get(`${BASE_URL}/validator/api/validationserverAPI.php`, {
    params: {
      val_id: valId,
      store_id: env.payment.sslcommerz.storeId,
      store_passwd: env.payment.sslcommerz.storePassword,
      format: "json",
    },
  });

  const isValid = data.status === "VALID" || data.status === "VALIDATED";
  return {
    isValid,
    transactionId: data.tran_id,
    amount: Number(data.amount),
    raw: data,
  };
}
