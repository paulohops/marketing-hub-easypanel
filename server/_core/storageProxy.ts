import type { Express, Request, Response } from "express";
import { stat } from "node:fs/promises";
import path from "node:path";
import { getStorageFilePath } from "../storage";

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

async function serveStoredFile(req: Request, res: Response) {
  const key = getKey(req);
  if (!key) {
    res.status(400).send("Missing storage key");
    return;
  }

  try {
    const filePath = getStorageFilePath(key);
    const fileInfo = await stat(filePath);
    if (!fileInfo.isFile()) {
      res.status(404).send("File not found");
      return;
    }

    res.setHeader("Content-Type", MIME_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream");
    res.setHeader("Content-Length", String(fileInfo.size));
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
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
