import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { operationalAlertsHandler } from "../operationalAlerts";
import { createContext } from "./context";
import { assertRuntimeEnvironment, ENV } from "./env";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { setupVite } from "./vite";
import { ensureStorageDir } from "../storage";
import { appError, appLog, registerProcessLogging } from "./logger";

registerProcessLogging();

async function startDevelopmentServer() {
  assertRuntimeEnvironment();
  await ensureStorageDir();

  const app = express();
  const server = createServer(app);
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "75mb" }));
  app.use(express.urlencoded({ limit: "75mb", extended: true }));
  app.get("/health", (_req, res) => res.status(200).json({ ok: true, service: "trade-hub" }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.post("/api/scheduled/operational-alerts", operationalAlertsHandler);
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  await setupVite(app, server);

  const port = Number.parseInt(ENV.port, 10);
  server.listen(port, "0.0.0.0", () => appLog("INFO", "Servidor de desenvolvimento iniciado", { port }));
}

startDevelopmentServer().catch(error => {
  appError("Falha ao iniciar o servidor de desenvolvimento", error);
  process.exitCode = 1;
});
