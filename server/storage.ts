import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ENV } from "./_core/env";

const storageRoot = path.resolve(ENV.storageDir);

export async function ensureStorageDir() {
  await mkdir(storageRoot, { recursive: true });
}

function normalizeKey(relKey: string): string {
  const key = relKey.replace(/\\/g, "/").replace(/^\/+/, "");
  const normalized = path.posix.normalize(key);
  if (!normalized || normalized === "." || normalized.startsWith("../") || normalized.includes("/../")) {
    throw new Error("Invalid storage key");
  }
  return normalized;
}

function absolutePathForKey(key: string): string {
  const absolutePath = path.resolve(storageRoot, key);
  if (absolutePath !== storageRoot && !absolutePath.startsWith(`${storageRoot}${path.sep}`)) {
    throw new Error("Invalid storage path");
  }
  return absolutePath;
}

function appendHashSuffix(relKey: string): string {
  const hash = randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  if (lastDot === -1) return `${relKey}_${hash}`;
  return `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

export function getStorageUrl(relKey: string): string {
  const key = normalizeKey(relKey);
  return `/uploads/${key.split("/").map(encodeURIComponent).join("/")}`;
}

export async function storagePut(
  relKey: string,
  data: Buffer | Uint8Array | string,
  _contentType = "application/octet-stream",
): Promise<{ key: string; url: string }> {
  const key = appendHashSuffix(normalizeKey(relKey));
  const absolutePath = absolutePathForKey(key);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, data);
  return { key, url: getStorageUrl(key) };
}

export async function storageGet(relKey: string): Promise<{ key: string; url: string }> {
  const key = normalizeKey(relKey);
  return { key, url: getStorageUrl(key) };
}

export async function storageGetSignedUrl(relKey: string): Promise<string> {
  return getStorageUrl(relKey);
}

export async function readStorageFile(relKey: string): Promise<Buffer> {
  return readFile(absolutePathForKey(normalizeKey(relKey)));
}

export function getStorageFilePath(relKey: string): string {
  return absolutePathForKey(normalizeKey(relKey));
}
