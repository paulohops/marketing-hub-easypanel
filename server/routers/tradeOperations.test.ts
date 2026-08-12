import { canTransitionOperationStatus, validateOperationDenomination } from "./tradeOperations";
import { describe, expect, it } from "vitest";

const baseOperation = {
  operationType: "trade_action" as const,
  actionTypeId: 7,
  mediaTypeId: null,
  eventTypeId: null,
  name: "Blitz regional Centro",
  cityId: 2,
  supplierId: 4,
  startsAt: new Date("2026-08-20T12:00:00Z"),
  endsAt: new Date("2026-08-21T12:00:00Z"),
  requiresPermit: true,
};

describe("operações unificadas", () => {
  it("aceita uma única denominação compatível com o tipo da operação", () => {
    expect(() => validateOperationDenomination(baseOperation)).not.toThrow();
  });

  it("rejeita denominações concorrentes ou incompatíveis", () => {
    expect(() => validateOperationDenomination({ ...baseOperation, mediaTypeId: 3 })).toThrow("exatamente uma denominação");
    expect(() => validateOperationDenomination({ ...baseOperation, actionTypeId: null })).toThrow("exatamente uma denominação");
  });

  it("impõe o fluxo planejado, aprovado, em execução e finalizado", () => {
    expect(canTransitionOperationStatus("planned", "approved")).toBe(true);
    expect(canTransitionOperationStatus("planned", "in_progress")).toBe(false);
    expect(canTransitionOperationStatus("approved", "in_progress")).toBe(true);
    expect(canTransitionOperationStatus("in_progress", "completed")).toBe(true);
    expect(canTransitionOperationStatus("completed", "planned")).toBe(false);
  });
});
