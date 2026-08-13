import { annualMonths, decodeOperationOptionId, distributeAnnualAmount, encodeOperationOptionId, monthBounds, totalCost } from "./budgets";
import { describe, expect, it } from "vitest";

describe("orçamento vivo", () => {
  it("calcula o intervalo UTC correto para a competência mensal", () => {
    const bounds = monthBounds("2026-08");
    expect(bounds.storedDate).toBe("2026-08-01");
    expect(bounds.start.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(bounds.end.toISOString()).toBe("2026-09-01T00:00:00.000Z");
  });

  it("soma todas as componentes aprováveis de um custo operacional", () => {
    expect(totalCost({ investmentBase: "1200.50", permitCost: "85.25", storeCost: "300.00", otherCosts: "14.25" })).toBe(1600);
  });

  it("codifica e decodifica operações de módulos distintos sem colisão de identificadores", () => {
    const action = encodeOperationOptionId("action", 12);
    const media = encodeOperationOptionId("media_campaign", 12);
    expect(action).not.toBe(media);
    expect(decodeOperationOptionId(action)).toEqual({ operationType: "action", operationId: 12 });
    expect(decodeOperationOptionId(media)).toEqual({ operationType: "media_campaign", operationId: 12 });
    expect(decodeOperationOptionId(12)).toBeNull();
  });

  it("distribui a verba anual por doze competências sem perder centavos", () => {
    expect(annualMonths(2026)).toHaveLength(12);
    expect(annualMonths(2026)[0]).toBe("2026-01");
    expect(annualMonths(2026)[11]).toBe("2026-12");
    const distribution = distributeAnnualAmount(1000);
    expect(distribution).toHaveLength(12);
    expect(distribution.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1000, 2);
    expect(distribution[0]).toBeGreaterThanOrEqual(distribution[11]);
  });
});
