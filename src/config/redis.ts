import Redis from "ioredis";
import { env } from "./env";

export const redis = env.redisUrl
  ? new Redis(env.redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy(times) {
        return null;
      },
    })
  : null;

if (redis) {
  redis.on("error", (err) => {
  });
  redis.on("connect", () => console.log("[redis] connected"));
}