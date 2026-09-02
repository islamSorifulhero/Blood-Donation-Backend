import { z } from "zod";

export const updateMeSchema = z.object({
  body: z
    .object({
      name: z.string().min(2).max(100).optional(),
      phone: z
        .string()
        .regex(/^\+?[0-9]{10,15}$/, "Enter a valid phone number")
        .optional(),
      avatar: z.string().url().optional(),
    })
    .refine((d) => Object.keys(d).length > 0, "At least one field is required"),
});

export const changePasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1),
    newPassword: z
      .string()
      .min(8)
      .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
      .regex(/[a-z]/, "Password must contain at least one lowercase letter")
      .regex(/[0-9]/, "Password must contain at least one number"),
  }),
});
