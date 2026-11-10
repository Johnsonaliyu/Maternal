import app from "./app";
import { logger } from "./lib/logger";
import { startWhatsApp } from "./materna/whatsapp";

// Make silent deaths visible in the deploy logs.
process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection (kept running)");
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception, exiting");
  setTimeout(() => process.exit(1), 200);
});
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    logger.warn({ signal }, "Received stop signal from the platform");
    process.exit(0);
  });
}
// Memory heartbeat: if the last line before a crash shows rss climbing, it is an OOM kill.
setInterval(() => {
  const m = process.memoryUsage();
  logger.info(
    { rssMB: Math.round(m.rss / 1048576), heapMB: Math.round(m.heapUsed / 1048576) },
    "memory heartbeat",
  );
}, 5 * 60_000).unref();

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  startWhatsApp().catch((error: unknown) => {
    logger.error({ err: error }, "Afeeyah AI WhatsApp startup failed");
  });
});          
