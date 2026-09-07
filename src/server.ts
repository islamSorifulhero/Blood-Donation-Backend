import { app } from "./app";
import { env } from "./config/env";

async function bootstrap() {
  try {
    app.listen(env.port, () => {
      console.log(`[server] Listening on port ${env.port} (${env.nodeEnv})`);
      console.log(`[server] API base: /api/${env.apiVersion}`);
    });
  } catch (err) {
    console.error("[server] Failed to start:", err);
    process.exit(1);
  }
}

process.on("unhandledRejection", (reason) => {
  console.error("[process] Unhandled rejection:", reason);
});

bootstrap();

export default app;