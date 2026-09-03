import { NotificationType, PaymentProvider, PaymentPurpose, PaymentStatus, Prisma } from "@prisma/client";
import { Request } from "express";
import { prisma } from "../../config/db";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import { getPagination, buildMeta } from "../../utils/pagination";
import { recordAuditLog } from "../../utils/audit";
import { createNotification } from "../../utils/notify";
import { generateTransactionId } from "../../utils/generateTransactionId";
import { getPaymentProvider } from "./providers";
import { AuthUser } from "../../middlewares/auth.middleware";
import { NormalizedStatus } from "./providers/types";

const HOSPITAL_VERIFICATION_FEE = 500; // BDT, flat
const PRIORITY_FEE_BY_URGENCY: Record<string, number> = {
  LOW: 200,
  MEDIUM: 400,
  HIGH: 700,
  CRITICAL: 1000,
};
const MIN_DONATION_AMOUNT = 50; // BDT
const CURRENCY = "BDT";

const API_BASE = `${env.clientUrl}`; // frontend handles redirect UX; backend just needs a stable URL shape
const CALLBACK_BASE = (req: Request) => `${req.protocol}://${req.get("host")}/api/${env.apiVersion}/payments`;

function purposeCode(purpose: PaymentPurpose): string {
  return { PRIORITY_REQUEST_FEE: "PRF", HOSPITAL_VERIFICATION_FEE: "HVF", PLATFORM_DONATION: "DON" }[purpose];
}

// Initiate — resolves the amount/eligibility per purpose, creates a
// PENDING Payment row, then calls the chosen gateway to open a session.
export async function initiatePayment(
  req: Request,
  user: AuthUser,
  input: { purpose: PaymentPurpose; provider: PaymentProvider; bloodRequestId?: string; amount?: number }
) {
  let amount: number;
  let bloodRequestId: string | undefined;

  if (input.purpose === PaymentPurpose.HOSPITAL_VERIFICATION_FEE) {
    if (user.role !== "HOSPITAL") throw ApiError.forbidden("Only hospitals can pay the verification fee");
    amount = HOSPITAL_VERIFICATION_FEE;
  } else if (input.purpose === PaymentPurpose.PRIORITY_REQUEST_FEE) {
    if (user.role !== "HOSPITAL") throw ApiError.forbidden("Only hospitals can pay a request priority fee");
    const request = await prisma.bloodRequest.findFirst({
      where: { id: input.bloodRequestId, deletedAt: null },
      include: { hospital: { select: { userId: true } } },
    });
    if (!request) throw ApiError.notFound("Blood request not found");
    if (request.hospital.userId !== user.id) throw ApiError.forbidden("This is not your blood request");
    if (["CANCELLED", "FULFILLED"].includes(request.status)) {
      throw ApiError.conflict("This request can no longer be prioritized");
    }
    amount = PRIORITY_FEE_BY_URGENCY[request.urgency];
    bloodRequestId = request.id;
  } else {
    // PLATFORM_DONATION
    if (!input.amount || input.amount < MIN_DONATION_AMOUNT) {
      throw ApiError.badRequest(`Minimum donation amount is ${MIN_DONATION_AMOUNT} ${CURRENCY}`);
    }
    amount = input.amount;
  }

  const transactionId = generateTransactionId(purposeCode(input.purpose));

  const payment = await prisma.payment.create({
    data: {
      userId: user.id,
      bloodRequestId,
      purpose: input.purpose,
      provider: input.provider,
      amount,
      currency: CURRENCY,
      transactionId,
      status: PaymentStatus.PENDING,
    },
  });

  const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, select: { name: true, email: true, phone: true } });
  const callbackBase = CALLBACK_BASE(req);

  try {
    const adapter = getPaymentProvider(input.provider);
    const session = await adapter.createSession({
      transactionId,
      amount,
      currency: CURRENCY,
      purpose: input.purpose,
      customerEmail: dbUser.email,
      customerName: dbUser.name,
      customerPhone: dbUser.phone ?? undefined,
      successUrl: `${API_BASE}/payments/success`,
      failUrl: `${callbackBase}/callback/sslcommerz/fail`,
      cancelUrl: `${API_BASE}/payments/cancel`,
      ipnUrl: `${callbackBase}/callback/sslcommerz/ipn`,
    });

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { gatewayResponse: session.raw as Prisma.InputJsonValue },
    });

    return { payment: updated, redirectUrl: session.redirectUrl, providerReference: session.providerReference };
  } catch (err) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.FAILED, gatewayResponse: { error: (err as Error).message } },
    });
    throw err instanceof ApiError ? err : ApiError.internal("Failed to initiate payment with provider");
  }
}

// Central status-update function — every webhook/callback funnels here.
// Idempotent: re-processing the same terminal status is a no-op.
export async function verifyAndUpdatePaymentStatus(
  transactionId: string,
  status: NormalizedStatus,
  gatewayResponse: unknown
) {
  const payment = await prisma.payment.findUnique({ where: { transactionId } });
  if (!payment) {
    // Unknown transaction — most likely a replayed/forged callback. Swallow silently
    // rather than throwing, since gateways expect a 200 even for unknown refs.
    return null;
  }
  if (payment.status !== PaymentStatus.PENDING) {
    return payment; // already processed — idempotent no-op
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: status as PaymentStatus,
        paidAt: status === "SUCCESS" ? new Date() : null,
        gatewayResponse: gatewayResponse as Prisma.InputJsonValue,
      },
    });

    await recordAuditLog(tx, {
      actorId: null,
      action: `PAYMENT_${status}`,
      entityType: "Payment",
      entityId: payment.id,
      oldValue: { status: PaymentStatus.PENDING },
      newValue: { status },
    });

    await createNotification(tx, {
      userId: payment.userId,
      type: NotificationType.PAYMENT_STATUS,
      title: status === "SUCCESS" ? "Payment successful" : "Payment not completed",
      message:
        status === "SUCCESS"
          ? `Your payment of ${payment.amount} ${payment.currency} for ${payment.purpose.replace(/_/g, " ").toLowerCase()} was successful.`
          : `Your payment of ${payment.amount} ${payment.currency} was ${status.toLowerCase()}.`,
    });

    return result;
  });

  return updated;
}

// List — role-scoped, paginated, filtered, sorted
interface ListFilters {
  status?: PaymentStatus;
  provider?: PaymentProvider;
  purpose?: PaymentPurpose;
  userId?: string;
  sortBy?: "createdAt" | "amount";
  sortOrder?: "asc" | "desc";
}

export async function listPayments(filters: ListFilters, query: Request["query"], requester: AuthUser) {
  const { page, limit, skip } = getPagination(query);

  const where: Prisma.PaymentWhereInput = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.provider ? { provider: filters.provider } : {}),
    ...(filters.purpose ? { purpose: filters.purpose } : {}),
  };

  if (requester.role === "ADMIN") {
    if (filters.userId) where.userId = filters.userId;
  } else {
    where.userId = requester.id;
  }

  const [items, total] = await prisma.$transaction([
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [filters.sortBy ?? "createdAt"]: filters.sortOrder ?? "desc" },
      include: { bloodRequest: { select: { id: true, patientName: true } } },
    }),
    prisma.payment.count({ where }),
  ]);

  return { items, meta: buildMeta(total, page, limit) };
}

export async function getPaymentById(id: string, requester: AuthUser) {
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { bloodRequest: { select: { id: true, patientName: true } } },
  });
  if (!payment) throw ApiError.notFound("Payment not found");
  if (requester.role !== "ADMIN" && payment.userId !== requester.id) {
    throw ApiError.forbidden("You do not have access to this payment");
  }
  return payment;
}
