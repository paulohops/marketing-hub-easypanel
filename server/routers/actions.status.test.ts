import { describe, expect, it } from "vitest";
import { canUpdateActionStatus, validActionRange } from "./actions";

describe("action status transitions", () => {
  it.each([
    ["planned", "in_progress"],
    ["planned", "completed"],
    ["planned", "cancelled"],
    ["in_progress", "paused"],
    ["in_progress", "completed"],
    ["in_progress", "cancelled"],
    ["paused", "in_progress"],
    ["paused", "completed"],
    ["paused", "cancelled"],
    ["completed", "completed"],
    ["completed", "in_progress"],
    ["cancelled", "cancelled"],
  ])("allows %s -> %s", (current, next) => {
    expect(canUpdateActionStatus(current, next)).toBe(true);
  });

  it.each([
    ["completed", "planned"],
    ["completed", "cancelled"],
    ["cancelled", "planned"],
    ["cancelled", "in_progress"],
    ["planned", "paused"],
    ["unknown", "completed"],
    ["planned", "unknown"],
  ])("rejects %s -> %s", (current, next) => {
    expect(canUpdateActionStatus(current, next)).toBe(false);
  });
});

describe("action date range", () => {
  it("accepts an open-ended action", () => {
    expect(validActionRange(new Date("2026-08-25T09:00:00Z"), null)).toBe(true);
  });

  it("rejects an end before the start", () => {
    expect(validActionRange(new Date("2026-08-25T12:00:00Z"), new Date("2026-08-25T11:00:00Z"))).toBe(false);
  });
});
