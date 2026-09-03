import { DonationStatus, MatchStatus, NotificationType, Prisma, RequestStatus } from "@prisma/client";
import { Request } from "express";
import { prisma } from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { getPagination, buildMeta } from "../../utils/pagination";
import { recordAuditLog } from "../../utils/audit";
import { createNotification } from "../../utils/notify";
import { bumpCacheVersion } from "../../utils/cache";
import { AuthUser } from "../../middlewares/auth.middleware";

const donationInclude = {
  donorProfile: { select: { id: true, userId: true, bloodGroup: true, user: { select: { name: true } } } },
  bloodRequest: {
    select: {
      id: true,
      patientName: true,
      bloodGroup: true,
      unitsNeeded: true,
      unitsFulfilled: true,
      status: true,
      hospital: { select: { userId: true, hospitalName: true } },
    },
  },
} satisfies Prisma.DonationInclude;

// Schedule a donation from an ACCEPTED match (donor only, their own match)
export async function scheduleDonation(
  donorUserId: string,
  data: { requestMatchId: string; donationDate: Date; location?: string; notes?: string }
) {
  const donorProfile = await prisma.donorProfile.findFirst({ where: { userId: donorUserId, deletedAt: null } });
  if (!donorProfile) throw ApiError.notFound("Donor profile not found");

  const match = await prisma.requestMatch.findUnique({
    where: { id: data.requestMatchId },
    include: { donation: true, bloodRequest: { select: { id: true, status: true } } },
  });
  if (!match || match.donorProfileId !== donorProfile.id) {
    throw ApiError.notFound("Match not found");
  }
  if (match.status !== MatchStatus.ACCEPTED) {
    throw ApiError.conflict("You can only schedule a donation for a match you have accepted");
  }
  if (match.donation) {
    throw ApiError.conflict("A donation has already been scheduled for this match");
  }
  if ([RequestStatus.CANCELLED, RequestStatus.FULFILLED].includes(match.bloodRequest.status)) {
    throw ApiError.conflict("This blood request is no longer accepting donations");
  }

  return prisma.donation.create({
    data: {
      bloodRequestId: match.bloodRequestId,
      donorProfileId: donorProfile.id,
      requestMatchId: match.id,
      donationDate: data.donationDate,
      location: data.location,
      notes: data.notes,
      status: DonationStatus.SCHEDULED,
    },
    include: donationInclude,
  });
}

// List — role-scoped, paginated, filtered, sorted
interface ListFilters {
  status?: DonationStatus;
  bloodRequestId?: string;
  donorId?: string;
  sortBy?: "donationDate" | "createdAt";
  sortOrder?: "asc" | "desc";
}

export async function listDonations(filters: ListFilters, query: Request["query"], requester: AuthUser) {
  const { page, limit, skip } = getPagination(query);

  const where: Prisma.DonationWhereInput = {
    deletedAt: null,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.bloodRequestId ? { bloodRequestId: filters.bloodRequestId } : {}),
  };

  if (requester.role === "DONOR") {
    const donorProfile = await prisma.donorProfile.findFirst({ where: { userId: requester.id } });
    where.donorProfileId = donorProfile?.id ?? "__none__";
  } else if (requester.role === "HOSPITAL") {
    where.bloodRequest = { hospital: { userId: requester.id } };
  } else if (filters.donorId) {
    where.donorProfileId = filters.donorId; // admin-only filter
  }

  const [items, total] = await prisma.$transaction([
    prisma.donation.findMany({
      where,
      include: donationInclude,
      skip,
      take: limit,
      orderBy: { [filters.sortBy ?? "donationDate"]: filters.sortOrder ?? "desc" },
    }),
    prisma.donation.count({ where }),
  ]);

  return { items, meta: buildMeta(total, page, limit) };
}

// Get by id — donor owner, hospital owner, or admin
export async function getDonationById(id: string, requester: AuthUser) {
  const donation = await prisma.donation.findFirst({ where: { id, deletedAt: null }, include: donationInclude });
  if (!donation) throw ApiError.notFound("Donation not found");
  assertCanAccess(donation, requester);
  return donation;
}

function assertCanAccess(
  donation: { donorProfile: { userId: string }; bloodRequest: { hospital: { userId: string } } },
  requester: AuthUser
) {
  const isDonor = requester.role === "DONOR" && donation.donorProfile.userId === requester.id;
  const isHospital = requester.role === "HOSPITAL" && donation.bloodRequest.hospital.userId === requester.id;
  if (!isDonor && !isHospital && requester.role !== "ADMIN") {
    throw ApiError.forbidden("You do not have access to this donation");
  }
}

// Complete — the core transaction. Hospital owner or admin only.
// Updates: donation status, donor totals/lastDonationDate, match status,
// and the parent blood request's unitsFulfilled/status — all atomically.
export async function completeDonation(
  id: string,
  requester: AuthUser,
  overrideUnits?: number,
  notes?: string
) {
  const donation = await prisma.donation.findFirst({
    where: { id, deletedAt: null },
    include: {
      donorProfile: { select: { id: true, userId: true, totalDonations: true } },
      bloodRequest: {
        select: { id: true, unitsNeeded: true, unitsFulfilled: true, status: true, hospital: { select: { userId: true } } },
      },
      requestMatch: { select: { id: true } },
    },
  });
  if (!donation) throw ApiError.notFound("Donation not found");

  const isHospitalOwner = requester.role === "HOSPITAL" && donation.bloodRequest.hospital.userId === requester.id;
  if (!isHospitalOwner && requester.role !== "ADMIN") {
    throw ApiError.forbidden("Only the requesting hospital or an admin can confirm a completed donation");
  }
  if (donation.status !== DonationStatus.SCHEDULED) {
    throw ApiError.conflict(`Donation is already ${donation.status.toLowerCase()}`);
  }
  if ([RequestStatus.CANCELLED, RequestStatus.FULFILLED].includes(donation.bloodRequest.status)) {
    throw ApiError.conflict("This blood request is no longer accepting donations");
  }

  const unitsDonated = overrideUnits ?? donation.unitsDonated;
  const completedAt = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const updatedDonation = await tx.donation.update({
      where: { id: donation.id },
      data: { status: DonationStatus.COMPLETED, unitsDonated, notes: notes ?? donation.notes },
    });

    const updatedDonor = await tx.donorProfile.update({
      where: { id: donation.donorProfile.id },
      data: {
        totalDonations: { increment: unitsDonated },
        lastDonationDate: completedAt,
      },
    });

    if (donation.requestMatch) {
      await tx.requestMatch.update({
        where: { id: donation.requestMatch.id },
        data: { status: MatchStatus.COMPLETED },
      });
    }

    const newUnitsFulfilled = donation.bloodRequest.unitsFulfilled + unitsDonated;
    const newStatus =
      newUnitsFulfilled >= donation.bloodRequest.unitsNeeded
        ? RequestStatus.FULFILLED
        : RequestStatus.PARTIALLY_FULFILLED;

    const updatedRequest = await tx.bloodRequest.update({
      where: { id: donation.bloodRequest.id },
      data: { unitsFulfilled: newUnitsFulfilled, status: newStatus },
    });

    await recordAuditLog(tx, {
      actorId: requester.id,
      action: "COMPLETE_DONATION",
      entityType: "Donation",
      entityId: donation.id,
      oldValue: { status: DonationStatus.SCHEDULED, donorTotalDonations: donation.donorProfile.totalDonations },
      newValue: { status: DonationStatus.COMPLETED, unitsDonated, donorTotalDonations: updatedDonor.totalDonations },
    });

    await createNotification(tx, {
      userId: donation.donorProfile.userId,
      type: NotificationType.DONATION_REMINDER,
      title: "Thank you for donating!",
      message: `Your donation of ${unitsDonated} unit(s) has been recorded. You've now donated ${updatedDonor.totalDonations} unit(s) in total. Thank you for saving a life.`,
    });

    await createNotification(tx, {
      userId: donation.bloodRequest.hospital.userId,
      type: NotificationType.REQUEST_FULFILLED,
      title: newStatus === RequestStatus.FULFILLED ? "Blood request fulfilled" : "Donation received",
      message:
        newStatus === RequestStatus.FULFILLED
          ? "Your blood request has been fully fulfilled."
          : `${newUnitsFulfilled}/${donation.bloodRequest.unitsNeeded} units received so far.`,
      bloodRequestId: donation.bloodRequest.id,
    });

    return { donation: updatedDonation, donorProfile: updatedDonor, bloodRequest: updatedRequest };
  });

  await bumpCacheVersion("blood-requests");
  return result;
}

// Cancel a scheduled donation — donor, hospital owner, or admin
export async function cancelDonation(id: string, requester: AuthUser, reason?: string) {
  const donation = await prisma.donation.findFirst({
    where: { id, deletedAt: null },
    include: { donorProfile: { select: { userId: true } }, bloodRequest: { select: { hospital: { select: { userId: true } } } } },
  });
  if (!donation) throw ApiError.notFound("Donation not found");
  assertCanAccess(donation, requester);
  if (donation.status !== DonationStatus.SCHEDULED) {
    throw ApiError.conflict(`Donation is already ${donation.status.toLowerCase()}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.donation.update({ where: { id: donation.id }, data: { status: DonationStatus.CANCELLED, notes: reason } });
    await recordAuditLog(tx, {
      actorId: requester.id,
      action: "CANCEL_DONATION",
      entityType: "Donation",
      entityId: donation.id,
      oldValue: { status: DonationStatus.SCHEDULED },
      newValue: { status: DonationStatus.CANCELLED, reason },
    });
  });
}

// Mark a scheduled donation as a no-show — hospital owner or admin
export async function markNoShow(id: string, requester: AuthUser, notes?: string) {
  const donation = await prisma.donation.findFirst({
    where: { id, deletedAt: null },
    include: { donorProfile: { select: { userId: true } }, bloodRequest: { select: { hospital: { select: { userId: true } } } } },
  });
  if (!donation) throw ApiError.notFound("Donation not found");

  const isHospitalOwner = requester.role === "HOSPITAL" && donation.bloodRequest.hospital.userId === requester.id;
  if (!isHospitalOwner && requester.role !== "ADMIN") {
    throw ApiError.forbidden("Only the requesting hospital or an admin can mark a no-show");
  }
  if (donation.status !== DonationStatus.SCHEDULED) {
    throw ApiError.conflict(`Donation is already ${donation.status.toLowerCase()}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.donation.update({ where: { id: donation.id }, data: { status: DonationStatus.NO_SHOW, notes } });
    await recordAuditLog(tx, {
      actorId: requester.id,
      action: "MARK_DONATION_NO_SHOW",
      entityType: "Donation",
      entityId: donation.id,
      oldValue: { status: DonationStatus.SCHEDULED },
      newValue: { status: DonationStatus.NO_SHOW, notes },
    });
    await createNotification(tx, {
      userId: donation.donorProfile.userId,
      type: NotificationType.GENERAL,
      title: "Missed donation appointment",
      message: "You were marked as a no-show for a scheduled donation. Please reach out if this was a mistake.",
    });
  });
}

// Reschedule a scheduled donation — donor only
export async function rescheduleDonation(id: string, donorUserId: string, donationDate: Date, location?: string) {
  const donation = await prisma.donation.findFirst({
    where: { id, deletedAt: null },
    include: { donorProfile: { select: { userId: true } } },
  });
  if (!donation) throw ApiError.notFound("Donation not found");
  if (donation.donorProfile.userId !== donorUserId) throw ApiError.forbidden("This donation does not belong to you");
  if (donation.status !== DonationStatus.SCHEDULED) {
    throw ApiError.conflict(`Donation is already ${donation.status.toLowerCase()}`);
  }

  return prisma.donation.update({
    where: { id: donation.id },
    data: { donationDate, location: location ?? donation.location },
    include: donationInclude,
  });
}
