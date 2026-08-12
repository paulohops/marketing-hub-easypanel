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

  it("apresenta apenas administração, segurança e governança", () => {
    render(<SettingsWorkspace />);

    expect(screen.getByRole("heading", { name: "Configurações" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cadastros operacionais em seus contextos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Usuários e permissões" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Segurança de acesso" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Auditoria e governança" })).toBeInTheDocument();
  });

  it("não oferece formulários de cadastro operacional nesta área", () => {
    render(<SettingsWorkspace />);

    expect(screen.queryByRole("button", { name: /adicionar regional/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /adicionar fornecedor/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /adicionar loja/i })).not.toBeInTheDocument();
  });
});
