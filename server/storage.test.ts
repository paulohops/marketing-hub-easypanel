import { describe, expect, it } from "vitest";
import { hasSupportedFileSignature } from "./storage";

function bytes(...values: number[]) {
  return new Uint8Array(values);
}

describe("hasSupportedFileSignature", () => {
  it.each([
    ["image/jpeg", bytes(0xff, 0xd8, 0xff, 0xe0)],
    ["image/png", bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)],
    ["image/webp", bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50)],
    ["application/pdf", bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37)],
    ["video/mp4", bytes(0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70)],
    ["audio/mp4", bytes(0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70)],
    ["video/webm", bytes(0x1a, 0x45, 0xdf, 0xa3)],
    ["audio/mpeg", bytes(0x49, 0x44, 0x33, 0x04)],
    ["audio/wav", bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45)],
    ["audio/x-wav", bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45)],
    ["audio/ogg", bytes(0x4f, 0x67, 0x67, 0x53)],
  ])("accepts a valid %s signature", (contentType, data) => {
    expect(hasSupportedFileSignature(data, contentType)).toBe(true);
  });

  it("rejects a payload whose signature does not match the declared MIME", () => {
    expect(hasSupportedFileSignature(bytes(0x25, 0x50, 0x44, 0x46), "image/png")).toBe(false);
  });

  it("rejects an unknown MIME type", () => {
    expect(hasSupportedFileSignature(bytes(1, 2, 3, 4), "application/octet-stream")).toBe(false);
  });
});
