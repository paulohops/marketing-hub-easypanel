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

  it("emite cookie protegido com sameSite lax em HTTPS direto (SEC-08)", () => {
    expect(getSessionCookieOptions(request("https"))).toMatchObject({
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  });

  it("reconhece HTTPS informado pelo proxy reverso mantendo sameSite lax", () => {
    expect(getSessionCookieOptions(request("http", { "x-forwarded-proto": "https" }))).toMatchObject({
      sameSite: "lax",
      secure: true,
    });
  });
});
