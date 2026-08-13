import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import SettingsWorkspace, { digitsOnly, hasDuplicateRegistryValue, normalizeRegistryValue } from "./SettingsWorkspace";

afterEach(cleanup);

describe("configurações administrativas", () => {
  it("mantém os auxiliares de normalização disponíveis para os módulos operacionais", () => {
    expect(normalizeRegistryValue("  Regional MG ")).toBe("regional mg");
    expect(hasDuplicateRegistryValue(["Regional MG", "Norte"], " regional mg ")).toBe(true);
    expect(digitsOnly("12.345.678/0001-95")).toBe("12345678000195");
  });

  it("apresenta administração, segurança e governança em área separada", () => {
    render(<SettingsWorkspace />);

    expect(screen.getByRole("heading", { name: "Configurações" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Usuários e permissões" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: "Segurança de acesso" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: "Auditoria e governança" }).length).toBeGreaterThan(0);
  });

  it("orienta que os cadastros operacionais ficam disponíveis em Gestão", () => {
    render(<SettingsWorkspace />);

    expect(screen.getByText(/cadastros que abastecem a operação ficam disponíveis em Gestão/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /empresas/i })).not.toBeInTheDocument();
  });
});
