import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ENV } from "./_core/env";

const storageRoot = path.resolve(ENV.storageDir);

function startsWithBytes(data: Uint8Array, signature: number[], offset = 0) {
  return signature.every((byte, index) => data[offset + index] === byte);
}

export function hasSupportedFileSignature(data: Uint8Array, contentType: string) {
  switch (contentType) {
    case "image/jpeg":
      return startsWithBytes(data, [0xff, 0xd8, 0xff]);
    case "image/png":
      return startsWithBytes(data, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/webp":
      return startsWithBytes(data, [0x52, 0x49, 0x46, 0x46]) && startsWithBytes(data, [0x57, 0x45, 0x42, 0x50], 8);
    case "application/pdf":
      return startsWithBytes(data, [0x25, 0x50, 0x44, 0x46]);
    case "video/mp4":
      return startsWithBytes(data, [0x66, 0x74, 0x79, 0x70], 4);
    case "video/webm":
      return startsWithBytes(data, [0x1a, 0x45, 0xdf, 0xa3]);
    case "audio/mpeg":
      return startsWithBytes(data, [0x49, 0x44, 0x33]) || (data[0] === 0xff && (data[1] & 0xe0) === 0xe0);
    case "audio/wav":
      return startsWithBytes(data, [0x52, 0x49, 0x46, 0x46]) && startsWithBytes(data, [0x57, 0x41, 0x56, 0x45], 8);
    case "audio/ogg":
      return startsWithBytes(data, [0x4f, 0x67, 0x67, 0x53]);
    default:
      return false;
  }
}

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
