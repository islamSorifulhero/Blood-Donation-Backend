import { Prisma, NotificationType } from "@prisma/client";
import { prisma } from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { getPagination, buildMeta } from "../../utils/pagination";
import { recordAuditLog } from "../../utils/audit";
import { createNotification } from "../../utils/notify";
import { Request } from "express";

const hospitalSelect = {
  id: true,
  hospitalName: true,
  registrationNumber: true,
  address: true,
  city: true,
  latitude: true,
  longitude: true,
  isVerified: true,
  verifiedAt: true,
  createdAt: true,
  user: { select: { id: true, name: true, email: true, phone: true } },
} satisfies Prisma.HospitalProfileSelect;

export async function getMyProfile(userId: string) {
  const profile = await prisma.hospitalProfile.findFirst({
    where: { userId, deletedAt: null },
    select: hospitalSelect,
  });
  if (!profile) throw ApiError.notFound("Hospital profile not found");
  return profile;
}

export async function updateMyProfile(
  userId: string,
  data: Partial<{ hospitalName: string; address: string; city: string; latitude: number; longitude: number }>
) {
  const existing = await prisma.hospitalProfile.findFirst({ where: { userId, deletedAt: null } });
  if (!existing) throw ApiError.notFound("Hospital profile not found");

  return prisma.hospitalProfile.update({
    where: { id: existing.id },
    data,
    select: hospitalSelect,
  });
}

interface ListHospitalsFilters {
  city?: string;
  isVerified?: boolean;
  search?: string;
  sortBy?: "createdAt" | "hospitalName";
  sortOrder?: "asc" | "desc";
  requesterRole: "DONOR" | "HOSPITAL" | "ADMIN";
}

export async function listHospitals(filters: ListHospitalsFilters, query: Request["query"]) {
  const { page, limit, skip } = getPagination(query);

  const where: Prisma.HospitalProfileWhereInput = {
    deletedAt: null,
    // Non-admins can only browse verified hospitals, regardless of what they pass in isVerified
    isVerified: filters.requesterRole === "ADMIN" ? filters.isVerified : true,
    ...(filters.city ? { city: { equals: filters.city, mode: "insensitive" } } : {}),
    ...(filters.search ? { hospitalName: { contains: filters.search, mode: "insensitive" } } : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.hospitalProfile.findMany({
      where,
      select: hospitalSelect,
      skip,
      take: limit,
      orderBy: { [filters.sortBy ?? "createdAt"]: filters.sortOrder ?? "desc" },
    }),
    prisma.hospitalProfile.count({ where }),
  ]);

  return { items, meta: buildMeta(total, page, limit) };
}

export async function getHospitalById(id: string, requesterRole: "DONOR" | "HOSPITAL" | "ADMIN") {
  const hospital = await prisma.hospitalProfile.findFirst({
    where: { id, deletedAt: null },
    select: hospitalSelect,
  });
  if (!hospital) throw ApiError.notFound("Hospital not found");
  if (requesterRole !== "ADMIN" && !hospital.isVerified) {
    throw ApiError.notFound("Hospital not found");
  }
  return hospital;
}

/** Admin-only: approve or revoke a hospital's verification. Writes an audit log and notifies the hospital. */
export async function verifyHospital(
  hospitalId: string,
  actorId: string,
  isVerified: boolean,
  remarks?: string
) {
  const hospital = await prisma.hospitalProfile.findFirst({ where: { id: hospitalId, deletedAt: null } });
  if (!hospital) throw ApiError.notFound("Hospital not found");

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.hospitalProfile.update({
      where: { id: hospital.id },
      data: {
        isVerified,
        verifiedById: isVerified ? actorId : null,
        verifiedAt: isVerified ? new Date() : null,
      },
      select: hospitalSelect,
    });

    await recordAuditLog(tx, {
      actorId,
      action: isVerified ? "VERIFY_HOSPITAL" : "REVOKE_HOSPITAL_VERIFICATION",
      entityType: "HospitalProfile",
      entityId: hospital.id,
      oldValue: { isVerified: hospital.isVerified },
      newValue: { isVerified, remarks },
    });

    await createNotification(tx, {
      userId: hospital.userId,
      type: NotificationType.GENERAL,
      title: isVerified ? "Hospital account verified" : "Hospital verification revoked",
      message: isVerified
        ? "Your hospital account has been verified. You can now create blood requests."
        : `Your hospital verification has been revoked.${remarks ? ` Reason: ${remarks}` : ""}`,
    });

    return result;
  });

  return updated;
}

/** Admin-only: soft-deletes the hospital profile and deactivates the linked user account. */
export async function deactivateHospital(hospitalId: string, actorId: string) {
  const hospital = await prisma.hospitalProfile.findFirst({ where: { id: hospitalId, deletedAt: null } });
  if (!hospital) throw ApiError.notFound("Hospital not found");

  await prisma.$transaction(async (tx) => {
    await tx.hospitalProfile.update({ where: { id: hospital.id }, data: { deletedAt: new Date() } });
    await tx.user.update({ where: { id: hospital.userId }, data: { isActive: false } });
    await recordAuditLog(tx, {
      actorId,
      action: "DEACTIVATE_HOSPITAL",
      entityType: "HospitalProfile",
      entityId: hospital.id,
      oldValue: { deletedAt: null },
      newValue: { deletedAt: new Date() },
    });
  });
}
