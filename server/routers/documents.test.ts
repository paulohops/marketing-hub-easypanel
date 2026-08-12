import { describe, expect, it } from "vitest";
import { permissionForEntity, safeName } from "./documents";

describe("documentos operacionais", () => {
  it("aplica a permissão do módulo proprietário a cada entidade", () => {
    expect(permissionForEntity("invoice", true)).toBe("finance.write");
    expect(permissionForEntity("stock", false)).toBe("inventory.read");
    expect(permissionForEntity("media_campaign", true)).toBe("media.write");
    expect(permissionForEntity("action", true)).toBe("actions.write");
    expect(permissionForEntity("event", true)).toBe("events.write");
    expect(permissionForEntity("regional_media", false)).toBe("media.read");
  });

  it("normaliza nomes de arquivo sem preservar caracteres inseguros", () => {
    expect(safeName("Nota fiscal / Março 2026.pdf")).toBe("Nota_fiscal_Marco_2026.pdf");
    expect(safeName("////")).toBe("arquivo");
  });
});
