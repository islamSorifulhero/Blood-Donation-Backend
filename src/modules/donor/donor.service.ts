import { Prisma } from "@prisma/client";
import { prisma } from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { getPagination, buildMeta } from "../../utils/pagination";
import { recordAuditLog } from "../../utils/audit";
import { getCacheVersion, bumpCacheVersion, getCached, setCached, buildCacheKey } from "../../utils/cache";
import { Request } from "express";

const DONORS_CACHE_TTL_SECONDS = 60;

const publicDonorSelect = {
  id: true,
  bloodGroup: true,
  city: true,
  isAvailable: true,
  lastDonationDate: true,
  totalDonations: true,
  latitude: true,
  longitude: true,
  createdAt: true,
  user: { select: { id: true, name: true, phone: true, email: true } },
} satisfies Prisma.DonorProfileSelect;

export async function getMyProfile(userId: string) {
  const profile = await prisma.donorProfile.findFirst({
    where: { userId, deletedAt: null },
    include: { user: { select: { id: true, name: true, email: true, phone: true, avatar: true } } },
  });
  if (!profile) throw ApiError.notFound("Donor profile not found");
  return profile;
}

export async function updateMyProfile(
  userId: string,
  data: Partial<{
    isAvailable: boolean;
    address: string;
    city: string;
    latitude: number;
    longitude: number;
    weightKg: number;
    medicalNotes: string;
  }>
) {
  const existing = await prisma.donorProfile.findFirst({ where: { userId, deletedAt: null } });
  if (!existing) throw ApiError.notFound("Donor profile not found");

  const updated = await prisma.donorProfile.update({ where: { id: existing.id }, data });
  await bumpCacheVersion("donors");
  return updated;
}

interface ListDonorsFilters {
  bloodGroup?: string;
  city?: string;
  isAvailable?: boolean;
  sortBy?: "createdAt" | "lastDonationDate" | "totalDonations";
  sortOrder?: "asc" | "desc";
}

export async function listDonors(filters: ListDonorsFilters, query: Request["query"]) {
  const { page, limit, skip } = getPagination(query);

  const version = await getCacheVersion("donors");
  const cacheKey = buildCacheKey("donors", version, { ...filters, page, limit });
  const cached = await getCached<{ items: unknown[]; meta: ReturnType<typeof buildMeta> }>(cacheKey);
  if (cached) return cached;

  const where: Prisma.DonorProfileWhereInput = {
    deletedAt: null,
    ...(filters.bloodGroup ? { bloodGroup: filters.bloodGroup as never } : {}),
    ...(filters.city ? { city: { equals: filters.city, mode: "insensitive" } } : {}),
    ...(filters.isAvailable !== undefined ? { isAvailable: filters.isAvailable } : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.donorProfile.findMany({
      where,
      select: publicDonorSelect,
      skip,
      take: limit,
      orderBy: { [filters.sortBy ?? "createdAt"]: filters.sortOrder ?? "desc" },
    }),
    prisma.donorProfile.count({ where }),
  ]);

  const result = { items, meta: buildMeta(total, page, limit) };
  await setCached(cacheKey, result, DONORS_CACHE_TTL_SECONDS);
  return result;
}

export async function getDonorById(id: string) {
  const donor = await prisma.donorProfile.findFirst({
    where: { id, deletedAt: null },
    select: publicDonorSelect,
  });
  if (!donor) throw ApiError.notFound("Donor not found");
  return donor;
}

/** Admin-only: soft-deletes the donor profile and deactivates the linked user account. */
export async function deactivateDonor(donorProfileId: string, actorId: string) {
  const donor = await prisma.donorProfile.findFirst({ where: { id: donorProfileId, deletedAt: null } });
  if (!donor) throw ApiError.notFound("Donor not found");

  await prisma.$transaction(async (tx) => {
    await tx.donorProfile.update({ where: { id: donor.id }, data: { deletedAt: new Date() } });
    await tx.user.update({ where: { id: donor.userId }, data: { isActive: false } });
    await recordAuditLog(tx, {
      actorId,
      action: "DEACTIVATE_DONOR",
      entityType: "DonorProfile",
      entityId: donor.id,
      oldValue: { deletedAt: null },
      newValue: { deletedAt: new Date() },
    });
  });
  await bumpCacheVersion("donors");
}
