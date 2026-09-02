import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";

type Client = Prisma.TransactionClient | typeof prisma;

export interface AuditInput {
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string;
}

export async function recordAuditLog(client: Client, input: AuditInput) {
  await client.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      oldValue: input.oldValue === undefined ? Prisma.JsonNull : (input.oldValue as Prisma.InputJsonValue),
      newValue: input.newValue === undefined ? Prisma.JsonNull : (input.newValue as Prisma.InputJsonValue),
      ipAddress: input.ipAddress,
    },
  });
}
