import { describe, expect, it } from "vitest";
import { summarizeAlerts } from "./operationalAlerts";

describe("summarizeAlerts", () => {
  it("agrupa os alertas por categoria operacional", () => {
    expect(summarizeAlerts([
      { category: "campaign_expiry", title: "", message: "", entityType: "media_campaign", entityId: 1 },
      { category: "payment_due", title: "", message: "", entityType: "invoice", entityId: 2 },
      { category: "payment_due", title: "", message: "", entityType: "invoice", entityId: 3 },
    ])).toBe("Campanhas: 1; pagamentos: 2; ações pendentes: 0.");
  });
});
