import { describe, expect, it } from "vitest";
import { requestIdFromHeader } from "./httpTelemetry";

describe("requestIdFromHeader", () => {
  it("preserves a safe incoming request ID", () => {
    expect(requestIdFromHeader("gateway-42")).toBe("gateway-42");
  });

  it("generates a UUID when the header is absent or unsafe", () => {
    expect(requestIdFromHeader(undefined)).toMatch(/^[0-9a-f-]{36}$/);
    expect(requestIdFromHeader("<script>alert(1)</script>")).toMatch(/^[0-9a-f-]{36}$/);
  });
});
