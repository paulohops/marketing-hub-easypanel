import express from "express";
import { createServer } from "http";
import { sql } from "drizzle-orm";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { operationalAlertsHandler } from "../operationalAlerts";
import { createContext } from "./context";
import { assertRuntimeEnvironment, ENV } from "./env";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { serveStatic } from "./static";
import { ensureStorageDir } from "../storage";
import { getDb } from "../db";
import { appError, appLog, registerProcessLogging } from "./logger";
import { registerHttpTelemetry } from "./httpTelemetry";

registerProcessLogging();

async function startServer() {
  assertRuntimeEnvironment();
  await ensureStorageDir();

  const app = express();
  const server = createServer(app);
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  registerHttpTelemetry(app);
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });

  app.use(express.json({ limit: "75mb" }));
  app.use(express.urlencoded({ limit: "75mb", extended: true }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true, service: "trade-hub" });
  });
  app.get("/ready", async (_req, res) => {
    try {
      const database = await getDb();
      if (!database) throw new Error("database unavailable");
      await database.execute(sql`select 1`);
      await ensureStorageDir();
      res.status(200).json({ ok: true, service: "trade-hub" });
    } catch {
      res.status(503).json({ ok: false, service: "trade-hub" });
    }
  });

  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.post("/api/scheduled/operational-alerts", operationalAlertsHandler);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );
  serveStatic(app);

  const port = Number.parseInt(ENV.port, 10);

  server.listen(port, "0.0.0.0", () => {
    appLog("INFO", "Servidor iniciado", { port });
  });
}

startServer().catch(error => {
  appError("Falha ao iniciar o servidor", error);
  process.exitCode = 1;
});
