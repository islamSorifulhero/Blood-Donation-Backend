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

app.set('trust proxy', 1);

const apiVersion = env.apiVersion || "v1";

// --- Security & core middleware ---
app.use(helmet());
app.use(
  cors({
    origin: env.clientUrl || "*",
    credentials: true,
  })
);
app.use(compression());
app.use(cookieParser());
app.use(morgan(env.nodeEnv === "development" ? "dev" : "combined"));
app.use(globalLimiter);

app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Blood Donation & Emergency Assistance Platform API is Live!",
    version: apiVersion,
  });
});

app.post(
  `/api/${apiVersion}/payments/webhook/stripe`,
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
app.use(`/api/${apiVersion}`, v1Router);

// --- 404 + error handling
app.use(notFoundHandler);
app.use(errorHandler);