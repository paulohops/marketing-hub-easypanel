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
import { registerMcpEndpoint } from "../mcp/handler";
import { runScheduledPostsPublisher, syncAllActiveAccounts } from "../social/apiService";

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
  registerMcpEndpoint(app);
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

    // Social Media Background Workers
    // 1. Publisher: Checks every 60s for scheduled posts ready to dispatch
    setInterval(() => {
      runScheduledPostsPublisher().catch(err => {
        appLog("WARN", "[Social Publisher Worker] Erro ao verificar posts agendados", { error: err?.message });
      });
    }, 60 * 1000);

    // 2. Metrics Sync: Checks every 60m for automated metrics sync via official APIs
    setInterval(() => {
      syncAllActiveAccounts().catch(err => {
        appLog("WARN", "[Social Metrics Worker] Erro ao sincronizar métricas", { error: err?.message });
      });
    }, 60 * 60 * 1000);
  });
}

startServer().catch(error => {
  appError("Falha ao iniciar o servidor", error);
  process.exitCode = 1;
});
