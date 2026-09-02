import { prisma } from "../../config/db";
import { ApiError } from "../../utils/ApiError";
import { comparePassword, hashPassword } from "../../utils/hash";

const meSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  provider: true,
  avatar: true,
  isEmailVerified: true,
  isActive: true,
  createdAt: true,
} as const;

export async function getMe(userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: meSelect });
  if (!user) throw ApiError.notFound("User not found");
  return user;
}

export async function updateMe(userId: string, data: Partial<{ name: string; phone: string; avatar: string }>) {
  if (data.phone) {
    const existing = await prisma.user.findFirst({ where: { phone: data.phone, NOT: { id: userId } } });
    if (existing) throw ApiError.conflict("Phone number already in use");
  }
  return prisma.user.update({ where: { id: userId }, data, select: meSelect });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
  if (!user) throw ApiError.notFound("User not found");
  if (!user.password) {
    throw ApiError.badRequest("This account uses Google sign-in and has no password to change");
  }

  const matches = await comparePassword(currentPassword, user.password);
  if (!matches) throw ApiError.unauthorized("Current password is incorrect");

  const hashed = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
}
