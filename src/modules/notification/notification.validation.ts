import { z } from "zod";

const booleanQueryParam = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === "true"));

export const listNotificationsQuerySchema = z.object({
  query: z.object({
    isRead: booleanQueryParam,
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const notificationIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid("Invalid notification id") }),
});
