import { z } from "zod";
import { PaymentProvider, PaymentPurpose, PaymentStatus } from "@prisma/client";

export const initiatePaymentSchema = z.object({
  body: z
    .object({
      purpose: z.nativeEnum(PaymentPurpose),
      provider: z.nativeEnum(PaymentProvider),
      bloodRequestId: z.string().uuid().optional(),
      // Only used (and required) for PLATFORM_DONATION — other purposes have a fixed/derived amount.
      amount: z.number().positive().optional(),
    })
    .refine((d) => d.purpose !== PaymentPurpose.PRIORITY_REQUEST_FEE || !!d.bloodRequestId, {
      message: "bloodRequestId is required for PRIORITY_REQUEST_FEE",
      path: ["bloodRequestId"],
    })
    .refine((d) => d.purpose !== PaymentPurpose.PLATFORM_DONATION || !!d.amount, {
      message: "amount is required for PLATFORM_DONATION",
      path: ["amount"],
    }),
});

export const listPaymentsQuerySchema = z.object({
  query: z.object({
    status: z.nativeEnum(PaymentStatus).optional(),
    provider: z.nativeEnum(PaymentProvider).optional(),
    purpose: z.nativeEnum(PaymentPurpose).optional(),
    userId: z.string().uuid().optional(), // admin-only filter
    sortBy: z.enum(["createdAt", "amount"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const paymentIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid payment id") }),
});
