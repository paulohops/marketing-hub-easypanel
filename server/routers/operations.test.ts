import { describe, expect, it } from "vitest";
import { canUpdateActionStatus } from "./actions";
import { validEventRange } from "./events";

describe("regras de operação", () => {
  it("impede mudança de status após ação finalizada", () => {
    expect(canUpdateActionStatus("completed", "in_progress")).toBe(false);
    expect(canUpdateActionStatus("planned", "in_progress")).toBe(true);
  });

  it("rejeita eventos cujo encerramento antecede o início", () => {
    expect(validEventRange(new Date("2026-08-14"), new Date("2026-08-13"))).toBe(false);
    expect(validEventRange(new Date("2026-08-14"), new Date("2026-08-14"))).toBe(true);
  });
});
