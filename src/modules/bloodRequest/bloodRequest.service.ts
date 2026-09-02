import { NotificationType, Prisma, RequestStatus } from "@prisma/client";
import { Request } from "express";
import { prisma } from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { getPagination, buildMeta } from "../../utils/pagination";
import { recordAuditLog } from "../../utils/audit";
import { createNotification } from "../../utils/notify";
import { getCacheVersion, bumpCacheVersion, getCached, setCached, buildCacheKey } from "../../utils/cache";
import { matchDonorsToRequest } from "./matching.service";
import { AuthUser } from "../../middlewares/auth.middleware";

const BLOOD_REQUESTS_CACHE_TTL_SECONDS = 20; // short TTL — this is time-sensitive emergency data

const requestListSelect = {
  id: true,
  patientName: true,
  patientAge: true,
  bloodGroup: true,
  unitsNeeded: true,
  unitsFulfilled: true,
  urgency: true,
  status: true,
  requiredBy: true,
  city: true,
  isVerified: true,
  createdAt: true,
  hospital: { select: { id: true, hospitalName: true, city: true } },
} satisfies Prisma.BloodRequestSelect;

// ------------------------------------------------------------------
// Create (HOSPITAL only — must already be verified)
// ------------------------------------------------------------------
export async function createBloodRequest(
  userId: string,
  data: {
    patientName: string;
    patientAge?: number;
    bloodGroup: string;
    unitsNeeded: number;
    urgency: string;
    reason?: string;
    requiredBy: Date;
    city: string;
    latitude: number;
    longitude: number;
  }
) {
  const hospital = await prisma.hospitalProfile.findFirst({ where: { userId, deletedAt: null } });
  if (!hospital) throw ApiError.notFound("Hospital profile not found");
  if (!hospital.isVerified) {
    throw ApiError.forbidden("Your hospital account must be verified by an admin before creating requests");
  }

  const created = await prisma.bloodRequest.create({
    data: {
      hospitalId: hospital.id,
      patientName: data.patientName,
      patientAge: data.patientAge,
      bloodGroup: data.bloodGroup as never,
      unitsNeeded: data.unitsNeeded,
      urgency: data.urgency as never,
      reason: data.reason,
      requiredBy: data.requiredBy,
      city: data.city,
      latitude: data.latitude,
      longitude: data.longitude,
      status: RequestStatus.PENDING_VERIFICATION,
    },
  });
  await bumpCacheVersion("blood-requests");
  return created;
}

// ------------------------------------------------------------------
// List — pagination + filtering + search + sorting
// ------------------------------------------------------------------
interface ListFilters {
  bloodGroup?: string;
  status?: string;
  urgency?: string;
  city?: string;
  search?: string;
  mine?: boolean;
  sortBy?: "createdAt" | "requiredBy" | "urgency";
  sortOrder?: "asc" | "desc";
}

export async function listBloodRequests(filters: ListFilters, query: Request["query"], requester: AuthUser) {
  const { page, limit, skip } = getPagination(query);

  // Only cache the "public" view: same output for every non-admin, non-`mine` requester.
  // Admin views (all statuses) and a hospital's `mine` view (their own pending requests)
  // are requester-specific and must always hit the DB directly.
  const isCacheable = !(requester.role === "ADMIN" || (requester.role === "HOSPITAL" && filters.mine));
  let cacheKey: string | null = null;

  if (isCacheable) {
    const version = await getCacheVersion("blood-requests");
    cacheKey = buildCacheKey("blood-requests", version, { ...filters, page, limit });
    const cached = await getCached<{ items: unknown[]; meta: ReturnType<typeof buildMeta> }>(cacheKey);
    if (cached) return cached;
  }

  const where: Prisma.BloodRequestWhereInput = {
    deletedAt: null,
    ...(filters.bloodGroup ? { bloodGroup: filters.bloodGroup as never } : {}),
    ...(filters.urgency ? { urgency: filters.urgency as never } : {}),
    ...(filters.city ? { city: { equals: filters.city, mode: "insensitive" } } : {}),
    ...(filters.search ? { patientName: { contains: filters.search, mode: "insensitive" } } : {}),
  };

  if (requester.role === "ADMIN") {
    if (filters.status) where.status = filters.status as never;
  } else if (requester.role === "HOSPITAL" && filters.mine) {
    where.hospital = { userId: requester.id };
    if (filters.status) where.status = filters.status as never;
  } else {
    // Public/donor/other-hospital view: never expose unverified requests, and
    // ignore any attempt to filter by PENDING_VERIFICATION.
    where.status =
      filters.status && filters.status !== RequestStatus.PENDING_VERIFICATION
        ? (filters.status as never)
        : { not: RequestStatus.PENDING_VERIFICATION };
  }

  const sortField = filters.sortBy ?? "createdAt";
  const orderBy: Prisma.BloodRequestOrderByWithRelationInput =
    sortField === "urgency"
      ? { urgency: filters.sortOrder ?? "desc" }
      : { [sortField]: filters.sortOrder ?? "desc" };

  const [items, total] = await prisma.$transaction([
    prisma.bloodRequest.findMany({ where, select: requestListSelect, skip, take: limit, orderBy }),
    prisma.bloodRequest.count({ where }),
  ]);

  const result = { items, meta: buildMeta(total, page, limit) };
  if (isCacheable && cacheKey) await setCached(cacheKey, result, BLOOD_REQUESTS_CACHE_TTL_SECONDS);
  return result;
}

// ------------------------------------------------------------------
// Get by id
// ------------------------------------------------------------------
export async function getBloodRequestById(id: string, requester: AuthUser) {
  const request = await prisma.bloodRequest.findFirst({
    where: { id, deletedAt: null },
    include: {
      hospital: { select: { id: true, hospitalName: true, city: true, userId: true } },
      _count: { select: { matches: true, donations: true } },
    },
  });
  if (!request) throw ApiError.notFound("Blood request not found");

  const isOwner = requester.role === "HOSPITAL" && request.hospital.userId === requester.id;
  if (request.status === RequestStatus.PENDING_VERIFICATION && requester.role !== "ADMIN" && !isOwner) {
    throw ApiError.notFound("Blood request not found");
  }

  return request;
}

// ------------------------------------------------------------------
// Admin verification — approves/rejects, and on approval runs the
// donor-matching engine in the same transaction.
// ------------------------------------------------------------------
export async function verifyBloodRequest(id: string, actorId: string, isVerified: boolean, remarks?: string) {
  const request = await prisma.bloodRequest.findFirst({
    where: { id, deletedAt: null },
    include: { hospital: { select: { userId: true } } },
  });
  if (!request) throw ApiError.notFound("Blood request not found");
  if (request.status !== RequestStatus.PENDING_VERIFICATION) {
    throw ApiError.conflict("Only pending requests can be verified or rejected");
  }

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.bloodRequest.update({
      where: { id: request.id },
      data: {
        isVerified,
        verifiedById: actorId,
        verifiedAt: new Date(),
        status: isVerified ? RequestStatus.VERIFIED : RequestStatus.CANCELLED,
      },
    });

    await recordAuditLog(tx, {
      actorId,
      action: isVerified ? "VERIFY_BLOOD_REQUEST" : "REJECT_BLOOD_REQUEST",
      entityType: "BloodRequest",
      entityId: request.id,
      oldValue: { status: request.status },
      newValue: { status: updated.status, remarks },
    });

    await createNotification(tx, {
      userId: request.hospital.userId,
      type: NotificationType.REQUEST_VERIFIED,
      title: isVerified ? "Blood request verified" : "Blood request rejected",
      message: isVerified
        ? "Your blood request has been verified. We are now matching you with nearby compatible donors."
        : `Your blood request was rejected.${remarks ? ` Reason: ${remarks}` : ""}`,
      bloodRequestId: request.id,
    });

    let matchResult = { matchedCount: 0 };
    if (isVerified) {
      matchResult = await matchDonorsToRequest(tx, updated);
    }

    return { updated, matchResult };
  });

  await bumpCacheVersion("blood-requests");
  return result;
}

// ------------------------------------------------------------------
// Cancel — hospital owner or admin
// ------------------------------------------------------------------
export async function cancelBloodRequest(id: string, requester: AuthUser, reason?: string) {
  const request = await prisma.bloodRequest.findFirst({
    where: { id, deletedAt: null },
    include: { hospital: { select: { userId: true } } },
  });
  if (!request) throw ApiError.notFound("Blood request not found");

  const isOwner = requester.role === "HOSPITAL" && request.hospital.userId === requester.id;
  if (!isOwner && requester.role !== "ADMIN") {
    throw ApiError.forbidden("You cannot cancel this request");
  }
  if ([RequestStatus.FULFILLED, RequestStatus.CANCELLED].includes(request.status)) {
    throw ApiError.conflict(`Request is already ${request.status.toLowerCase()}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.bloodRequest.update({ where: { id: request.id }, data: { status: RequestStatus.CANCELLED } });
    await tx.requestMatch.updateMany({
      where: { bloodRequestId: request.id, status: "NOTIFIED" },
      data: { status: "EXPIRED" },
    });
    await recordAuditLog(tx, {
      actorId: requester.id,
      action: "CANCEL_BLOOD_REQUEST",
      entityType: "BloodRequest",
      entityId: request.id,
      oldValue: { status: request.status },
      newValue: { status: RequestStatus.CANCELLED, reason },
    });
  });
  await bumpCacheVersion("blood-requests");
}

// ------------------------------------------------------------------
// List matches for a request (hospital owner or admin)
// ------------------------------------------------------------------
export async function listMatchesForRequest(requestId: string, requester: AuthUser) {
  const request = await prisma.bloodRequest.findFirst({
    where: { id: requestId, deletedAt: null },
    include: { hospital: { select: { userId: true } } },
  });
  if (!request) throw ApiError.notFound("Blood request not found");

  const isOwner = requester.role === "HOSPITAL" && request.hospital.userId === requester.id;
  if (!isOwner && requester.role !== "ADMIN") {
    throw ApiError.forbidden("You cannot view matches for this request");
  }

  const matches = await prisma.requestMatch.findMany({
    where: { bloodRequestId: requestId },
    orderBy: { notifiedAt: "asc" },
    include: {
      donorProfile: {
        select: {
          id: true,
          bloodGroup: true,
          city: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  // Only reveal donor contact info once they've accepted — protects donor privacy pre-consent.
  return matches.map((m) => ({
    id: m.id,
    status: m.status,
    notifiedAt: m.notifiedAt,
    respondedAt: m.respondedAt,
    donor: {
      id: m.donorProfile.id,
      name: m.donorProfile.user.name,
      bloodGroup: m.donorProfile.bloodGroup,
      city: m.donorProfile.city,
    },
  }));
}

// ------------------------------------------------------------------
// Donor responds to a match notification
// ------------------------------------------------------------------
export async function respondToMatch(
  requestId: string,
  matchId: string,
  donorUserId: string,
  response: "ACCEPTED" | "DECLINED"
) {
  const match = await prisma.requestMatch.findFirst({
    where: { id: matchId, bloodRequestId: requestId },
    include: {
      donorProfile: { select: { userId: true } },
      bloodRequest: { select: { hospital: { select: { userId: true } }, status: true, patientName: true } },
    },
  });
  if (!match) throw ApiError.notFound("Match not found");
  if (match.donorProfile.userId !== donorUserId) {
    throw ApiError.forbidden("This match does not belong to you");
  }
  if (match.status !== "NOTIFIED") {
    throw ApiError.conflict(`You have already responded to this match (${match.status})`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.requestMatch.update({
      where: { id: match.id },
      data: { status: response, respondedAt: new Date() },
    });

    await recordAuditLog(tx, {
      actorId: donorUserId,
      action: response === "ACCEPTED" ? "ACCEPT_MATCH" : "DECLINE_MATCH",
      entityType: "RequestMatch",
      entityId: match.id,
      oldValue: { status: "NOTIFIED" },
      newValue: { status: response },
    });

    if (response === "ACCEPTED") {
      await createNotification(tx, {
        userId: match.bloodRequest.hospital.userId,
        type: NotificationType.BLOOD_REQUEST_MATCH,
        title: "A donor accepted your request",
        message: `A donor has accepted the blood request for ${match.bloodRequest.patientName}. Coordinate the donation via the donation module.`,
        bloodRequestId: requestId,
      });
    }

    return result;
  });

  return updated;
}
