import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { env } from "./config/env";
import { stripeWebhookHandler } from "./modules/payment/payment.controller";
import { globalLimiter } from "./middlewares/rateLimiter";
import { notFoundHandler, errorHandler } from "./middlewares/error.middleware";
import { router as v1Router } from "./routes/v1";

export const app: Application = express();

// --- Security & core middleware ---
app.use(helmet());
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
  })
);
app.use(compression());
app.use(cookieParser());
app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));
app.use(globalLimiter);

// NOTE: the raw body for the Stripe webhook route must be registered
// BEFORE express.json() — see routes/v1/payment.routes.ts for the pattern.
app.post(
  `/api/${env.apiVersion}/payments/webhook/stripe`,
  express.raw({ type: "application/json" }),
  stripeWebhookHandler
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Health check ---
app.get("/health", (_req, res) => {
  res.status(200).json({ success: true, message: "OK", data: { uptime: process.uptime() } });
});

// --- API routes ---
app.use(`/api/${env.apiVersion}`, v1Router);

// --- 404 + error handling (must be last) ---
app.use(notFoundHandler);
app.use(errorHandler);
