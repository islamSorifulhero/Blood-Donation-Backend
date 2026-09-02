import { Prisma } from "@prisma/client";
import { Request } from "express";
import { prisma } from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { getPagination, buildMeta } from "../../utils/pagination";

export async function listMyNotifications(userId: string, isRead: boolean | undefined, query: Request["query"]) {
  const { page, limit, skip } = getPagination(query);

  const where: Prisma.NotificationWhereInput = {
    userId,
    ...(isRead !== undefined ? { isRead } : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.notification.findMany({ where, skip, take: limit, orderBy: { createdAt: "desc" } }),
    prisma.notification.count({ where }),
  ]);

  return { items, meta: buildMeta(total, page, limit) };
}

export async function getUnreadCount(userId: string) {
  const count = await prisma.notification.count({ where: { userId, isRead: false } });
  return { unreadCount: count };
}

export async function markAsRead(userId: string, id: string) {
  const notification = await prisma.notification.findUnique({ where: { id } });
  if (!notification || notification.userId !== userId) {
    throw ApiError.notFound("Notification not found");
  }
  if (notification.isRead) return notification;

  return prisma.notification.update({ where: { id }, data: { isRead: true } });
}

export async function markAllAsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return { updatedCount: result.count };
}
