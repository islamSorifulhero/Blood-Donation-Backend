import dotenv from "dotenv";
dotenv.config();

function required(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 5000),
  apiVersion: process.env.API_VERSION ?? "v1",

  databaseUrl: required("DATABASE_URL"),
  redisUrl: process.env.REDIS_URL,

  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET"),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
    refreshSecret: required("JWT_REFRESH_SECRET"),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "30d",
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  },

  mail: {
    host: process.env.SMTP_HOST ?? "",
    port: Number(process.env.SMTP_PORT ?? 587),
    user: process.env.SMTP_USER ?? "",
    pass: process.env.SMTP_PASS ?? "",
    from: process.env.MAIL_FROM ?? "no-reply@blooddonation.app",
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? "",
    apiKey: process.env.CLOUDINARY_API_KEY ?? "",
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? "",
  },

  payment: {
    bkash: {
      appKey: process.env.BKASH_APP_KEY ?? "",
      appSecret: process.env.BKASH_APP_SECRET ?? "",
      username: process.env.BKASH_USERNAME ?? "",
      password: process.env.BKASH_PASSWORD ?? "",
      baseUrl: process.env.BKASH_BASE_URL ?? "",
    },
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY ?? "",
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    },
    sslcommerz: {
      storeId: process.env.SSLCOMMERZ_STORE_ID ?? "",
      storePassword: process.env.SSLCOMMERZ_STORE_PASSWORD ?? "",
      isLive: process.env.SSLCOMMERZ_IS_LIVE === "true",
    },
  },

  admin: {
    email: process.env.ADMIN_EMAIL ?? "admin@blooddonation.app",
    password: process.env.ADMIN_PASSWORD ?? "ChangeMe123!",
  },

  clientUrl: process.env.CLIENT_URL ?? "http://localhost:3000",
};
