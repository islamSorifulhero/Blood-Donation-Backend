import { Prisma, Role } from "@prisma/client";
import { Request } from "express";
import { prisma } from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { getPagination, buildMeta } from "../../utils/pagination";
import { recordAuditLog } from "../../utils/audit";
import { createNotification } from "../../utils/notify";
import { NotificationType } from "@prisma/client";

// User management
interface ListUsersFilters {
  role?: Role;
  isActive?: boolean;
  search?: string;
  sortBy?: "createdAt" | "name";
  sortOrder?: "asc" | "desc";
}

export async function listUsers(filters: ListUsersFilters, query: Request["query"]) {
  const { page, limit, skip } = getPagination(query);

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.isActive !== undefined ? { isActive: filters.isActive } : {}),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            { email: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        provider: true,
        isActive: true,
        isEmailVerified: true,
        createdAt: true,
      },
      skip,
      take: limit,
      orderBy: { [filters.sortBy ?? "createdAt"]: filters.sortOrder ?? "desc" },
    }),
    prisma.user.count({ where }),
  ]);

  return { items, meta: buildMeta(total, page, limit) };
}

export async function updateUserRole(userId: string, actorId: string, newRole: Role) {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) throw ApiError.notFound("User not found");
  if (user.role === Role.ADMIN) throw ApiError.forbidden("Cannot change an admin's role");
  if (user.role === newRole) throw ApiError.conflict(`User already has role ${newRole}`);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id: user.id }, data: { role: newRole } });

    await recordAuditLog(tx, {
      actorId,
      action: "UPDATE_USER_ROLE",
      entityType: "User",
      entityId: user.id,
      oldValue: { role: user.role },
      newValue: { role: newRole },
    });

    await createNotification(tx, {
      userId: user.id,
      type: NotificationType.GENERAL,
      title: "Account role updated",
      message: `Your account role was changed to ${newRole}. Note: you may need to complete a ${newRole.toLowerCase()} profile.`,
    });

    return updated;
  });
}

export async function updateUserStatus(userId: string, actorId: string, isActive: boolean, reason?: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) throw ApiError.notFound("User not found");
  if (user.role === Role.ADMIN) throw ApiError.forbidden("Cannot change another admin's status");
  if (user.isActive === isActive) throw ApiError.conflict(`User is already ${isActive ? "active" : "inactive"}`);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id: user.id }, data: { isActive } });

    await recordAuditLog(tx, {
      actorId,
      action: isActive ? "ACTIVATE_USER" : "DEACTIVATE_USER",
      entityType: "User",
      entityId: user.id,
      oldValue: { isActive: user.isActive },
      newValue: { isActive, reason },
    });

    await createNotification(tx, {
      userId: user.id,
      type: NotificationType.GENERAL,
      title: isActive ? "Account reactivated" : "Account deactivated",
      message: isActive
        ? "Your account has been reactivated."
        : `Your account has been deactivated.${reason ? ` Reason: ${reason}` : ""}`,
    });

    return updated;
  });
}

// Dashboard analytics
export async function getDashboardStats() {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [
    totalDonors,
    availableDonors,
    totalHospitals,
    verifiedHospitals,
    requestsByStatus,
    donationsByStatus,
    requestsThisMonth,
    donationsThisMonth,
    paymentsSuccessAgg,
    topCities,
  ] = await prisma.$transaction([
    prisma.donorProfile.count({ where: { deletedAt: null } }),
    prisma.donorProfile.count({ where: { deletedAt: null, isAvailable: true } }),
    prisma.hospitalProfile.count({ where: { deletedAt: null } }),
    prisma.hospitalProfile.count({ where: { deletedAt: null, isVerified: true } }),
    prisma.bloodRequest.groupBy({ by: ["status"], where: { deletedAt: null }, _count: true }),
    prisma.donation.groupBy({ by: ["status"], where: { deletedAt: null }, _count: true }),
    prisma.bloodRequest.count({ where: { deletedAt: null, createdAt: { gte: startOfMonth } } }),
    prisma.donation.count({ where: { deletedAt: null, createdAt: { gte: startOfMonth }, status: "COMPLETED" } }),
    prisma.payment.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true }, _count: true }),
    prisma.bloodRequest.groupBy({
      by: ["city"],
      where: { deletedAt: null },
      _count: true,
      orderBy: { _count: { city: "desc" } },
      take: 5,
    }),
  ]);

  return {
    donors: { total: totalDonors, available: availableDonors },
    hospitals: { total: totalHospitals, verified: verifiedHospitals, pendingVerification: totalHospitals - verifiedHospitals },
    bloodRequests: {
      byStatus: Object.fromEntries(requestsByStatus.map((r) => [r.status, r._count])),
      createdThisMonth: requestsThisMonth,
    },
    donations: {
      byStatus: Object.fromEntries(donationsByStatus.map((d) => [d.status, d._count])),
      completedThisMonth: donationsThisMonth,
    },
    payments: {
      totalSuccessfulAmount: paymentsSuccessAgg._sum.amount ?? 0,
      totalSuccessfulCount: paymentsSuccessAgg._count,
    },
    topCitiesByRequests: topCities.map((c) => ({ city: c.city, requestCount: c._count })),
  };
}

// Audit logs
interface AuditLogFilters {
  entityType?: string;
  action?: string;
  actorId?: string;
  from?: Date;
  to?: Date;
  sortOrder?: "asc" | "desc";
}

export async function listAuditLogs(filters: AuditLogFilters, query: Request["query"]) {
  const { page, limit, skip } = getPagination(query);

  const where: Prisma.AuditLogWhereInput = {
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.actorId ? { actorId: filters.actorId } : {}),
    ...(filters.from || filters.to
      ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: filters.sortOrder ?? "desc" },
      include: { actor: { select: { id: true, name: true, role: true } } },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { items, meta: buildMeta(total, page, limit) };
}