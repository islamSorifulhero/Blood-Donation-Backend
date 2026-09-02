import { Router } from "express";
import { authenticate } from "../../middlewares/auth.middleware";
import { validateRequest } from "../../middlewares/validateRequest";
import * as controller from "../../modules/payment/payment.controller";
import {
  initiatePaymentSchema,
  listPaymentsQuerySchema,
  paymentIdParamSchema,
} from "../../modules/payment/payment.validation";

const router = Router();

// NOTE: POST /payments/webhook/stripe is intentionally NOT defined here.
// It's mounted directly in app.ts with express.raw() so Stripe's signature
// verification gets the untouched request body — see app.ts for why.

router.post("/initiate", authenticate, validateRequest(initiatePaymentSchema), controller.initiatePayment);

router.get("/", authenticate, validateRequest(listPaymentsQuerySchema), controller.listPayments);

router.get("/:id", authenticate, validateRequest(paymentIdParamSchema), controller.getPaymentById);

// SSLCommerz callbacks — public (called by the gateway / payer's browser), form-encoded.
// Never trust these bodies directly; each handler re-validates server-to-server.
router.post("/callback/sslcommerz/success", controller.sslcommerzSuccess);
router.post("/callback/sslcommerz/fail", controller.sslcommerzFail);
router.post("/callback/sslcommerz/cancel", controller.sslcommerzCancel);
router.post("/callback/sslcommerz/ipn", controller.sslcommerzIpn);

export { router as paymentRouter };
