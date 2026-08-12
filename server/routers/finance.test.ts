import { describe, expect, it } from "vitest";
import { paymentStatus } from "./finance";

describe("paymentStatus", () => {
  it("identifica uma nota sem pagamento como aberta", () => {
    expect(paymentStatus(100, 0)).toBe("open");
  });

  it("identifica pagamento parcial e quitação", () => {
    expect(paymentStatus(100, 40)).toBe("partially_paid");
    expect(paymentStatus(100, 100)).toBe("paid");
  });
});
