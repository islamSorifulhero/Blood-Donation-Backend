import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import { ApiError } from "../../utils/ApiError";
import * as paymentService from "./payment.service";
import { verifyStripeWebhook } from "./providers/stripe.provider";
import { validateSslcommerzTransaction } from "./providers/sslcommerz.provider";

export const initiatePayment = catchAsync(async (req: Request, res: Response) => {
  const result = await paymentService.initiatePayment(req, req.user!, req.body);
  sendResponse(res, {
    statusCode: 201,
    message: "Payment session created",
    data: {
      paymentId: result.payment.id,
      transactionId: result.payment.transactionId,
      amount: result.payment.amount,
      currency: result.payment.currency,
      status: result.payment.status,
      redirectUrl: result.redirectUrl,
    },
  });
});

export const listPayments = catchAsync(async (req: Request, res: Response) => {
  const { status, provider, purpose, userId, sortBy, sortOrder } = req.query as unknown as {
    status?: import("@prisma/client").PaymentStatus;
    provider?: import("@prisma/client").PaymentProvider;
    purpose?: import("@prisma/client").PaymentPurpose;
    userId?: string;
    sortBy?: "createdAt" | "amount";
    sortOrder?: "asc" | "desc";
  };
  const result = await paymentService.listPayments(
    { status, provider, purpose, userId, sortBy, sortOrder },
    req.query,
    req.user!
  );
  sendResponse(res, { statusCode: 200, message: "Payments fetched", data: result.items, meta: result.meta });
});

export const getPaymentById = catchAsync(async (req: Request, res: Response) => {
  const payment = await paymentService.getPaymentById(req.params.id, req.user!);
  sendResponse(res, { statusCode: 200, message: "Payment fetched", data: payment });
});

// ------------------------------------------------------------------
// Stripe webhook — mounted in app.ts with express.raw() BEFORE express.json(),
// so req.body here is a Buffer, not parsed JSON. Do not move this route.
// ------------------------------------------------------------------
export const stripeWebhookHandler = catchAsync(async (req: Request, res: Response) => {
  const event = verifyStripeWebhook(req.body as Buffer, req.headers["stripe-signature"]);
  if (event) {
    await paymentService.verifyAndUpdatePaymentStatus(event.transactionId, event.status, event.raw);
  }
  // Stripe expects a fast 200 acknowledging receipt regardless of business outcome.
  res.status(200).json({ received: true });
});

// ------------------------------------------------------------------
// SSLCommerz callbacks — the gateway POSTs form-encoded data directly from
// the payer's browser to these URLs. The body is NOT trusted on its own;
// success/fail must be re-validated against SSLCommerz's Validation API.
// ------------------------------------------------------------------
export const sslcommerzSuccess = catchAsync(async (req: Request, res: Response) => {
  const { val_id, tran_id } = req.body;
  if (!val_id || !tran_id) throw ApiError.badRequest("Missing val_id/tran_id in SSLCommerz callback");

  const validation = await validateSslcommerzTransaction(val_id);
  const status = validation.isValid ? "SUCCESS" : "FAILED";
  await paymentService.verifyAndUpdatePaymentStatus(tran_id, status, validation.raw);

  res.status(200).json({ success: validation.isValid, message: validation.isValid ? "Payment verified" : "Validation failed" });
});

export const sslcommerzFail = catchAsync(async (req: Request, res: Response) => {
  const { tran_id } = req.body;
  if (tran_id) await paymentService.verifyAndUpdatePaymentStatus(tran_id, "FAILED", req.body);
  res.status(200).json({ success: false, message: "Payment failed" });
});

export const sslcommerzCancel = catchAsync(async (req: Request, res: Response) => {
  const { tran_id } = req.body;
  if (tran_id) await paymentService.verifyAndUpdatePaymentStatus(tran_id, "CANCELLED", req.body);
  res.status(200).json({ success: false, message: "Payment cancelled" });
});

// IPN (Instant Payment Notification) — server-to-server, same re-validation rule applies.
export const sslcommerzIpn = catchAsync(async (req: Request, res: Response) => {
  const { val_id, tran_id } = req.body;
  if (!val_id || !tran_id) return res.status(200).json({ received: true });

  const validation = await validateSslcommerzTransaction(val_id);
  const status = validation.isValid ? "SUCCESS" : "FAILED";
  await paymentService.verifyAndUpdatePaymentStatus(tran_id, status, validation.raw);

  res.status(200).json({ received: true });
});
