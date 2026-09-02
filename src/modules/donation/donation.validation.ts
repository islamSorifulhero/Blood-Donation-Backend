import { z } from "zod";
import { DonationStatus } from "@prisma/client";

export const scheduleDonationSchema = z.object({
  body: z.object({
    requestMatchId: z.string().uuid("Invalid match id"),
    donationDate: z.coerce.date().refine((d) => d.getTime() >= Date.now() - 60 * 60 * 1000, {
      message: "donationDate cannot be in the past",
    }),
    location: z.string().max(200).optional(),
    notes: z.string().max(500).optional(),
  }),
});

export const listDonationsQuerySchema = z.object({
  query: z.object({
    status: z.nativeEnum(DonationStatus).optional(),
    bloodRequestId: z.string().uuid().optional(),
    donorId: z.string().uuid().optional(), // admin/hospital use — filter by donor profile id
    sortBy: z.enum(["donationDate", "createdAt"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    page: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(100).optional(),
  }),
});

export const donationIdParamSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid donation id"),
  }),
});

export const completeDonationSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid donation id"),
  }),
  body: z
    .object({
      unitsDonated: z.number().int().positive().max(4).optional(),
      notes: z.string().max(500).optional(),
    })
    .optional(),
});

export const cancelDonationSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid donation id"),
  }),
  body: z
    .object({
      reason: z.string().max(500).optional(),
    })
    .optional(),
});

export const noShowDonationSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid donation id"),
  }),
  body: z
    .object({
      notes: z.string().max(500).optional(),
    })
    .optional(),
});

export const rescheduleDonationSchema = z.object({
  params: z.object({
    id: z.string().uuid("Invalid donation id"),
  }),
  body: z.object({
    donationDate: z.coerce.date().refine((d) => d.getTime() >= Date.now() - 60 * 60 * 1000, {
      message: "donationDate cannot be in the past",
    }),
    location: z.string().max(200).optional(),
  }),
});
