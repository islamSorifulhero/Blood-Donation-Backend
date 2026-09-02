import { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "../config/db";

type Client = Prisma.TransactionClient | typeof prisma;

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  bloodRequestId?: string;
}

export async function createNotification(client: Client, input: NotifyInput) {
  await client.notification.create({ data: input });
}
