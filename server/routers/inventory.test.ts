import { describe, expect, it } from "vitest";
import { calculateStockBalance, orderMovementHistory } from "./inventory";

describe("calculateStockBalance", () => {
  it("soma entradas e ajustes e desconta saídas", () => {
    expect(calculateStockBalance([
      { movementType: "entry", quantity: "20.00" },
      { movementType: "exit", quantity: "4.50" },
      { movementType: "adjustment", quantity: "1.50" },
    ])).toBe(17);
  });

  it("ordena o histórico do evento mais recente para o mais antigo, desempantando pelo identificador", () => {
    const ordered = orderMovementHistory([
      { id: 2, occurredAt: new Date("2026-08-10T09:00:00Z") },
      { id: 1, occurredAt: new Date("2026-08-11T09:00:00Z") },
      { id: 3, occurredAt: new Date("2026-08-11T09:00:00Z") },
    ]);
    expect(ordered.map(movement => movement.id)).toEqual([3, 1, 2]);
  });
});
