import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { operationalAlertsHandler } from "../operationalAlerts";
import { createContext } from "./context";
import { assertRuntimeEnvironment } from "./env";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { serveStatic, setupVite } from "./vite";
import { ensureStorageDir } from "../storage";

async function startServer() {
  assertRuntimeEnvironment();
  await ensureStorageDir();

  const app = express();
  const server = createServer(app);
  app.set("trust proxy", 1);

  // Configure body parser with larger size limit for file uploads.
  app.use(express.json({ limit: "75mb" }));
  app.use(express.urlencoded({ limit: "75mb", extended: true }));

  app.get("/health", (_req, res) => {
    res.status(200).json({ ok: true, service: "trade-hub" });
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

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = Number.parseInt(process.env.PORT ?? "3000", 10);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT inválida: ${process.env.PORT ?? ""}`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`Trade HUB running on port ${port}`);
  });
}

startServer().catch(error => {
  console.error("[Server] Startup failed", error);
  process.exitCode = 1;
});
