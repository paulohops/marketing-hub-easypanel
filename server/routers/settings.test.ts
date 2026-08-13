import { describe, expect, it } from "vitest";
import { getTrelloEmbedUrl, normalizeCnpj, normalizeSpreadsheetKey, normalizeTrelloUrl, uniqueIds } from "./settings";

describe("uniqueIds", () => {
  it("remove vínculos repetidos antes da persistência N:N", () => {
    expect(uniqueIds([4, 2, 4, 9, 2])).toEqual([4, 2, 9]);
  });
});

describe("normalizeCnpj", () => {
  it("remove a formatação e preserva os 14 dígitos do CNPJ", () => {
    expect(normalizeCnpj("12.345.678/0001-95")).toBe("12345678000195");
  });
});

describe("normalizeTrelloUrl", () => {
  it("aceita uma URL pública ou incorporável do Trello", () => {
    expect(normalizeTrelloUrl("https://trello.com/b/abC123/quadro-comercial")).toBe("https://trello.com/b/abC123/quadro-comercial");
  });

  it("rejeita URLs externas para impedir a incorporação arbitrária", () => {
    expect(() => normalizeTrelloUrl("https://example.com/quadro")).toThrow("A URL deve pertencer ao Trello.");
  });
});

describe("getTrelloEmbedUrl", () => {
  it("acrescenta a instrução de incorporação preservando parâmetros existentes", () => {
    expect(getTrelloEmbedUrl("https://trello.com/b/abC123/quadro-comercial?view=board")).toBe("https://trello.com/b/abC123/quadro-comercial?view=board&embed=1");
  });
});

describe("normalizeSpreadsheetKey", () => {
  it("normaliza maiúsculas, espaços e acentos para relacionar linhas importadas", () => {
    expect(normalizeSpreadsheetKey("  Região São José  ")).toBe("regiao sao jose");
  });
});
