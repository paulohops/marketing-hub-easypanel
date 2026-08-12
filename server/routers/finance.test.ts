import { describe, expect, it } from "vitest";
import { deriveInvoiceStatus, invoiceListFiltersInput, paymentStatus } from "./finance";

describe("paymentStatus", () => {
  it("identifica uma nota sem pagamento como aberta", () => {
    expect(paymentStatus(100, 0)).toBe("open");
  });

  it("identifica pagamento parcial e quitação", () => {
    expect(paymentStatus(100, 40)).toBe("partially_paid");
    expect(paymentStatus(100, 100)).toBe("paid");
  });
});

describe("filtros financeiros avançados", () => {
  it("aceita filtros combinados de status, vencimento, fornecedor e campanha", () => {
    expect(invoiceListFiltersInput.parse({ status: "overdue", dueStartsAt: "2026-08-01", dueEndsAt: "2026-08-31", supplierId: 3, operationType: "media_campaign", operationId: 9 })).toMatchObject({ status: "overdue", supplierId: 3, operationType: "media_campaign", operationId: 9 });
  });

  it("rejeita datas e identificadores inválidos e calcula vencimento sem alterar notas pagas", () => {
    expect(invoiceListFiltersInput.safeParse({ dueStartsAt: "31/08/2026", supplierId: 0 }).success).toBe(false);
    expect(deriveInvoiceStatus("open", "2026-08-10", "2026-08-12")).toBe("overdue");
    expect(deriveInvoiceStatus("paid", "2026-08-10", "2026-08-12")).toBe("paid");
  });
});
