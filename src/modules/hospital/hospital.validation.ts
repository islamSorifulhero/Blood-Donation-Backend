import { z } from "zod";

// registrationNumber and isVerified are intentionally excluded — registration
// number is immutable once set, and verification status can only change
// through the dedicated admin-only /verify endpoint below.
export const updateHospitalProfileSchema = z.object({
  body: z
    .object({
      hospitalName: z.string().min(2).max(150).optional(),
      address: z.string().min(3).optional(),
      city: z.string().min(2).optional(),
      latitude: z.number().min(-90).max(90).optional(),
      longitude: z.number().min(-180).max(180).optional(),
    })
    .refine((data) => Object.keys(data).length > 0, "At least one field is required"),
});

const booleanQueryParam = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === "true"));

export const listHospitalsQuerySchema = z.object({
  query: z.object({
    city: z.string().optional(),
    isVerified: booleanQueryParam,
    search: z.string().optional(), // matches against hospitalName
    sortBy: z.enum(["createdAt", "hospitalName"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const hospitalIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid hospital id"),
  }),
});

export const verifyHospitalSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid hospital id"),
  }),
  body: z.object({
    isVerified: z.boolean(),
    remarks: z.string().max(500).optional(),
  }),
});
