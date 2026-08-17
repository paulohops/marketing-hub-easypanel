import { describe, expect, it } from "vitest";
import { calculateStockBalance, canApplyStockMovement, inventoryHistoryInput, orderMovementHistory } from "./inventory";

describe("calculateStockBalance", () => {
  it("soma entradas e ajustes e desconta saídas", () => {
    expect(calculateStockBalance([
      { movementType: "entry", quantity: "20.00" },
      { movementType: "exit", quantity: "4.50" },
      { movementType: "adjustment", quantity: "1.50" },
    ])).toBe(17);
  });

  it("mantém a soma numérica quando uma entrada de 10 é adicionada a um saldo de 50", () => {
    expect(calculateStockBalance([
      { movementType: "entry", quantity: "50.00" },
      { movementType: "entry", quantity: "10.00" },
    ])).toBe(60);
  });

  it("ordena o histórico do evento mais recente para o mais antigo, desempantando pelo identificador", () => {
    const ordered = orderMovementHistory([
      { id: 2, occurredAt: new Date("2026-08-10T09:00:00Z") },
      { id: 1, occurredAt: new Date("2026-08-11T09:00:00Z") },
      { id: 3, occurredAt: new Date("2026-08-11T09:00:00Z") },
    ]);
    expect(ordered.map(movement => movement.id)).toEqual([3, 1, 2]);
  });

  it("rejeita uma saída que deixaria o saldo abaixo de zero antes da atualização atômica", () => {
    expect(canApplyStockMovement(3, "exit", 4)).toBe(false);
    expect(canApplyStockMovement(3, "exit", 3)).toBe(true);
  });

  it("aceita paginação e filtros territoriais dentro dos limites do histórico", () => {
    expect(inventoryHistoryInput.parse({ stockItemId: 7, regionalId: 2, cityId: 5, page: 3, pageSize: 50 })).toMatchObject({ stockItemId: 7, regionalId: 2, cityId: 5, page: 3, pageSize: 50 });
    expect(inventoryHistoryInput.safeParse({ page: 0, pageSize: 101 }).success).toBe(false);
  });
});
