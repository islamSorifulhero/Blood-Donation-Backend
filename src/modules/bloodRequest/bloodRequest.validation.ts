import { z } from "zod";
import { BloodGroup, RequestStatus, UrgencyLevel } from "@prisma/client";

export const createBloodRequestSchema = z.object({
  body: z.object({
    patientName: z.string().min(2).max(100),
    patientAge: z.number().int().positive().max(120).optional(),
    bloodGroup: z.nativeEnum(BloodGroup),
    unitsNeeded: z.number().int().positive().max(20),
    urgency: z.nativeEnum(UrgencyLevel),
    reason: z.string().max(500).optional(),
    requiredBy: z.coerce.date().refine((d) => d.getTime() > Date.now(), "requiredBy must be in the future"),
    city: z.string().min(2),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
});

const booleanQueryParam = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === "true"));

export const listBloodRequestsQuerySchema = z.object({
  query: z.object({
    bloodGroup: z.nativeEnum(BloodGroup).optional(),
    status: z.nativeEnum(RequestStatus).optional(),
    urgency: z.nativeEnum(UrgencyLevel).optional(),
    city: z.string().optional(),
    search: z.string().optional(), // matches patientName
    mine: booleanQueryParam, // hospital: only their own requests (incl. unverified)
    sortBy: z.enum(["createdAt", "requiredBy", "urgency"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const bloodRequestIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid blood request id"),
  }),
});

export const verifyBloodRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid blood request id"),
  }),
  body: z.object({
    isVerified: z.boolean(),
    remarks: z.string().max(500).optional(),
  }),
});

export const cancelBloodRequestSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid blood request id"),
  }),
  body: z
    .object({
      reason: z.string().max(500).optional(),
    })
    .optional(),
});

export const respondToMatchSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid blood request id"),
    matchId: z.string().uuid("Invalid match id"),
  }),
  body: z.object({
    response: z.enum(["ACCEPTED", "DECLINED"]),
  }),
});
