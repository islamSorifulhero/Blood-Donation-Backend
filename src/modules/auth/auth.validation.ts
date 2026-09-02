import { z } from "zod";
import { BloodGroup, Gender, Role } from "@prisma/client";

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number");

const phone = z
  .string()
  .regex(/^\+?[0-9]{10,15}$/, "Enter a valid phone number");

export const registerDonorSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100),
    email: z.string().email(),
    phone,
    password,
    bloodGroup: z.nativeEnum(BloodGroup),
    dateOfBirth: z.coerce.date(),
    gender: z.nativeEnum(Gender),
    weightKg: z.number().positive().max(400),
    address: z.string().min(3),
    city: z.string().min(2),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
});

export const registerHospitalSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(100), // contact person's name
    email: z.string().email(),
    phone,
    password,
    hospitalName: z.string().min(2).max(150),
    registrationNumber: z.string().min(2).max(100),
    address: z.string().min(3),
    city: z.string().min(2),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  }),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(1, "Password is required"),
  }),
});

export const googleAuthSchema = z.object({
  body: z.object({
    idToken: z.string().min(10, "Google ID token is required"),
    // Only required for first-time sign-up; ignored if the account already exists.
    role: z.enum([Role.DONOR, Role.HOSPITAL]).optional(),
  }),
});

export const refreshTokenSchema = z.object({
  body: z
    .object({
      refreshToken: z.string().optional(),
    })
    .optional(),
});
