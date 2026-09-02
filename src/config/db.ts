import { PrismaClient } from "@prisma/client";
import { env } from "./env";

// Prevent multiple PrismaClient instances in dev (hot-reload) / serverless warm starts
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  global.__prisma ??
  new PrismaClient({
    log: env.nodeEnv === "development" ? ["warn", "error"] : ["error"],
  });

if (env.nodeEnv !== "production") {
  global.__prisma = prisma;
}
