import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildOperationalReportWorkbook, reportDateRangeValid } from "./ReportExportPanel";

describe("exportação de relatórios", () => {
  it("valida um período cronológico", () => {
    expect(reportDateRangeValid("2026-08-01", "2026-08-31")).toBe(true);
    expect(reportDateRangeValid("2026-08-31", "2026-08-01")).toBe(false);
  });

  it("gera abas para o resumo, operação e financeiro filtradas pelo período", () => {
    const workbook = buildOperationalReportWorkbook({
      media: [{ name: "Outdoor Centro", activeCampaign: { name: "Campanha Agosto", startsOn: "2026-08-05", endsOn: "2026-08-31", estimatedCost: "1200", status: "active" } }],
      actions: [{ action: { name: "Blitz", startsAt: "2026-08-10", status: "completed" }, debrief: { rating: 5, worthRepeating: true } }],
      events: [{ event: { name: "Feira", startsAt: "2026-07-10", status: "completed" } }],
      invoices: [{ number: "NF-1", issuedAt: "2026-08-03", totalAmount: "300", totalPaid: "100", outstandingAmount: "200", status: "pending" }],
    }, "2026-08-01", "2026-08-31");

    expect(workbook.SheetNames).toEqual(["Resumo", "Mídias", "Ações", "Eventos", "Financeiro"]);
    expect(XLSX.utils.sheet_to_json(workbook.Sheets["Mídias"])).toHaveLength(1);
    expect(XLSX.utils.sheet_to_json(workbook.Sheets["Eventos"])).toHaveLength(0);
    expect(XLSX.utils.sheet_to_json(workbook.Sheets["Financeiro"])).toHaveLength(1);
  });
});
