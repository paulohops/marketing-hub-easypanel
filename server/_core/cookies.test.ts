import type { Request } from "express";
import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./cookies";

function request(protocol: string, headers: Record<string, string | string[]> = {}) {
  return { protocol, headers } as unknown as Request;
}

describe("getSessionCookieOptions", () => {
  it("emite cookie compatível com HTTP local", () => {
    expect(getSessionCookieOptions(request("http"))).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: false,
    });
  });

  it("emite cookie cross-site protegido em HTTPS direto", () => {
    expect(getSessionCookieOptions(request("https"))).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
    });
  });

  it("reconhece HTTPS informado pelo proxy reverso", () => {
    expect(getSessionCookieOptions(request("http", { "x-forwarded-proto": "https" }))).toMatchObject({
      sameSite: "none",
      secure: true,
    });
  });
});
