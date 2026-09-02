import { z } from "zod";
import { BloodGroup } from "@prisma/client";

// Blood group, date of birth and gender are set once at registration and are
// intentionally NOT editable here — corrections to medically sensitive fields
// should go through an admin-assisted flow, not a self-service PATCH.
export const updateDonorProfileSchema = z.object({
  body: z
    .object({
      isAvailable: z.boolean().optional(),
      address: z.string().min(3).optional(),
      city: z.string().min(2).optional(),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
      weightKg: z.number().positive().max(400).optional(),
      medicalNotes: z.string().max(1000).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, "At least one field is required"),
});

const booleanQueryParam = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === "true"));

export const listDonorsQuerySchema = z.object({
  query: z.object({
    bloodGroup: z.nativeEnum(BloodGroup).optional(),
    city: z.string().optional(),
    isAvailable: booleanQueryParam,
    sortBy: z.enum(["createdAt", "lastDonationDate", "totalDonations"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const donorIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid donor id"),
  }),
});
