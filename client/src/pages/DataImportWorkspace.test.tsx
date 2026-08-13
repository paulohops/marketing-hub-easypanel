import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseOperationalWorkbook, validateOperationalRows } from "./DataImportWorkspace";

describe("importação operacional por planilha", () => {
  it("lê as quatro abas do modelo e converte coordenadas numéricas", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ name: "Cluster MG" }]), "Empresas");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ providerName: "Cluster MG", name: "Minas", code: "MG" }]), "Regionais");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ regionalCode: "MG", name: "Belo Horizonte", state: "mg", latitude: "-19,92", longitude: "-43,94" }]), "Cidades");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([{ regionalCode: "MG", cityName: "Belo Horizonte", name: "Loja Centro", code: "BH-01" }]), "Lojas");

    const parsed = parseOperationalWorkbook(workbook);

    expect(parsed.providers[0].name).toBe("Cluster MG");
    expect(parsed.regionals[0].code).toBe("MG");
    expect(parsed.cities[0]).toMatchObject({ state: "MG", latitude: -19.92, longitude: -43.94 });
    expect(parsed.stores[0].code).toBe("BH-01");
    expect(validateOperationalRows(parsed)).toEqual([]);
  });

  it("aponta campos territoriais obrigatórios antes de permitir a gravação", () => {
    expect(validateOperationalRows({ providers: [], regionals: [], cities: [{ regionalCode: "", name: "", state: "M" }], stores: [] })).toContain("Cidades: a linha 2 precisa de regionalCode, name e state com UF de 2 letras.");
  });
});
