import { monthBounds, totalCost } from "./budgets";
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
});
