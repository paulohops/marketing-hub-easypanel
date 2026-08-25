import type { Express } from "express";
import { randomUUID } from "node:crypto";
import { appLog } from "./logger";

export function requestIdFromHeader(value: string | undefined) {
  const candidate = value?.trim();
  return candidate && /^[A-Za-z0-9._:-]{1,128}$/.test(candidate) ? candidate : randomUUID();
}

export function registerHttpTelemetry(app: Express) {
  app.use((req, res, next) => {
    const requestId = requestIdFromHeader(req.get("x-request-id"));
    const startedAt = Date.now();
    res.setHeader("X-Request-ID", requestId);
    res.on("finish", () => {
      if (!req.path.startsWith("/api/") && req.path !== "/health" && req.path !== "/ready") return;
      appLog(res.statusCode >= 500 ? "ERROR" : res.statusCode >= 400 ? "WARN" : "INFO", "HTTP request completed", {
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs: Date.now() - startedAt,
      });
    });
    next();
  });
}
