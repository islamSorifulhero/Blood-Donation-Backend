import { z } from "zod";
import { Role } from "@prisma/client";

const booleanQueryParam = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === "true"));

export const listUsersQuerySchema = z.object({
  query: z.object({
    role: z.nativeEnum(Role).optional(),
    isActive: booleanQueryParam,
    search: z.string().optional(), // matches name or email
    sortBy: z.enum(["createdAt", "name"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const userIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid user id") }),
});

export const updateUserRoleSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid user id") }),
  body: z.object({
    // ADMIN is intentionally excluded — admin accounts are never granted via this endpoint.
    role: z.enum([Role.DONOR, Role.HOSPITAL]),
  }),
});

export const updateUserStatusSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid user id") }),
  body: z.object({
    isActive: z.boolean(),
    reason: z.string().max(500).optional(),
  }),
});

export const listAuditLogsQuerySchema = z.object({
  query: z.object({
    entityType: z.string().optional(),
    action: z.string().optional(),
    actorId: z.string().uuid().optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});
