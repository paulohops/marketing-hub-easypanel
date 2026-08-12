import { describe, expect, it } from "vitest";
import { hasModulePermission } from "./permissions";

describe("permissões de navegação", () => {
  it("oculta configurações para perfis sem permissão", () => {
    expect(hasModulePermission("viewer", "settings.read")).toBe(false);
  });

  it("libera acesso administrativo a qualquer módulo", () => {
    expect(hasModulePermission("admin", "settings.read")).toBe(true);
  });
});
