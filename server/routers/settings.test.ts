import { describe, expect, it } from "vitest";
import { getTrelloEmbedUrl, normalizeAppBranding, normalizeCnpj, normalizeSpreadsheetKey, normalizeTrelloUrl, normalizeWebsiteUrl, uniqueIds } from "./settings";

describe("normalizeAppBranding", () => {
  it("aplica defaults para dados incompletos e normaliza cores hexadecimais", () => {
    expect(normalizeAppBranding({ appName: "  Operação HUB  ", primaryColor: "#12ab34", fontFamily: "inter", logoUrl: "https://cdn.example.com/logo.png" })).toMatchObject({
      appName: "Operação HUB",
      appSubtitle: "CLUSTER MG",
      primaryColor: "#12AB34",
      accentColor: "#F45103",
      fontFamily: "inter",
      logoUrl: "https://cdn.example.com/logo.png",
    });
  });

  it("rejeita silenciosamente cores, fontes e logos inválidos usando o padrão", () => {
    expect(normalizeAppBranding({ appName: "X", primaryColor: "red", fontFamily: "comic-sans", logoUrl: "javascript:alert(1)" })).toMatchObject({
      appName: "MARKETING HUB",
      primaryColor: "#0E723B",
      fontFamily: "montserrat",
      logoUrl: "/brand/logo.svg",
    });
  });
});

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

describe("normalizeWebsiteUrl", () => {
  it("adiciona HTTPS quando o usuário informa apenas o domínio", () => {
    expect(normalizeWebsiteUrl("www.cluster.com.br")).toBe("https://www.cluster.com.br/");
  });

  it("rejeita protocolos que não são HTTP ou HTTPS", () => {
    expect(() => normalizeWebsiteUrl("javascript:alert(1)")).toThrow("O site deve usar uma URL HTTP ou HTTPS válida.");
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
