import { describe, expect, it } from "vitest";
import { canUpdateActionStatus, normalizeStockAllocations, validActionRange } from "./actions";
import { normalizeEventStockAllocations, validEventRange } from "./events";

describe("regras de operação", () => {
  it("permite corrigir o status de uma ação diretamente na ficha", () => {
    expect(canUpdateActionStatus("completed", "in_progress")).toBe(true);
    expect(canUpdateActionStatus("planned", "in_progress")).toBe(true);
  });

  it("rejeita eventos cujo encerramento antecede o início", () => {
    expect(validEventRange(new Date("2026-08-14"), new Date("2026-08-13"))).toBe(false);
    expect(validEventRange(new Date("2026-08-14"), new Date("2026-08-14"))).toBe(true);
  });

  it("aceita apenas encerramento posterior ou igual ao início da ação", () => {
    expect(validActionRange(new Date("2026-08-14T14:00:00Z"), new Date("2026-08-14T13:59:00Z"))).toBe(false);
    expect(validActionRange(new Date("2026-08-14T14:00:00Z"), new Date("2026-08-14T14:00:00Z"))).toBe(true);
    expect(validActionRange(new Date("2026-08-14T14:00:00Z"), null)).toBe(true);
  });

  it("consolida recursos repetidos por item antes de persistir o planejamento", () => {
    const resources = [{ stockItemId: 5, quantity: 1 }, { stockItemId: 9, quantity: 2 }, { stockItemId: 5, quantity: 3 }];
    expect(normalizeStockAllocations(resources)).toEqual([{ stockItemId: 5, quantity: 3 }, { stockItemId: 9, quantity: 2 }]);
    expect(normalizeEventStockAllocations(resources)).toEqual([{ stockItemId: 5, quantity: 3 }, { stockItemId: 9, quantity: 2 }]);
  });
});
