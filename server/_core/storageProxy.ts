import type { Express, Request, Response } from "express";
import { stat } from "node:fs/promises";
import path from "node:path";
import { getStorageFilePath } from "../storage";
import { sdk } from "./sdk";

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webm": "video/webm",
  ".webp": "image/webp",
  ".wav": "audio/wav",
};

function getKey(req: Request): string {
  const raw = (req.params as Record<string, string>)[0] ?? "";
  return decodeURIComponent(raw);
}

const PUBLIC_STORAGE_PREFIXES = ["trade/app-branding/"];

async function canReadStoredFile(req: Request, key: string) {
  if (PUBLIC_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))) return true;
  try {
    return Boolean(await sdk.authenticateRequest(req));
  } catch {
    return false;
  }
}

async function serveStoredFile(req: Request, res: Response) {
  const key = getKey(req);
  if (!key) {
    res.status(400).send("Missing storage key");
    return;
  }

  if (!(await canReadStoredFile(req, key))) {
    res.status(401).send("Authentication required");
    return;
  }

  try {
    const filePath = getStorageFilePath(key);
    const fileInfo = await stat(filePath);
    if (!fileInfo.isFile()) {
      res.status(404).send("File not found");
      return;
    }

    const isPublic = PUBLIC_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix));
    res.setHeader("Content-Type", MIME_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream");
    res.setHeader("Content-Length", String(fileInfo.size));
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", isPublic ? "public, max-age=31536000, immutable" : "private, no-store");
    res.sendFile(filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") {
      res.status(404).send("File not found");
      return;
    }
    console.error("[LocalStorage] failed:", error);
    res.status(400).send("Invalid storage path");
  }
}

export function registerStorageProxy(app: Express) {
  app.get("/uploads/*", serveStoredFile);
  // Backward-compatible alias for URLs created by the original Manus version.
  app.get("/manus-storage/*", serveStoredFile);
}
