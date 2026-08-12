import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/OperationalRegistriesPanel", () => ({
  default: () => <section><h2>Cadastros operacionais</h2><button>Empresas</button><button>Regionais</button><button>Cidades</button><button>Fornecedores e preços</button><button>Tipos de mídia</button><button>Categorias financeiras</button></section>,
}));
import SettingsWorkspace, { digitsOnly, hasDuplicateRegistryValue, normalizeRegistryValue } from "./SettingsWorkspace";

afterEach(cleanup);

describe("configurações administrativas", () => {
  it("mantém os auxiliares de normalização disponíveis para os módulos operacionais", () => {
    expect(normalizeRegistryValue("  Regional MG ")).toBe("regional mg");
    expect(hasDuplicateRegistryValue(["Regional MG", "Norte"], " regional mg ")).toBe(true);
    expect(digitsOnly("12.345.678/0001-95")).toBe("12345678000195");
  });

  it("apresenta administração, segurança, governança e cadastros operacionais", () => {
    render(<SettingsWorkspace />);

    expect(screen.getAllByRole("heading", { name: "Cadastros" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: "Cadastros operacionais" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: "Usuários e permissões" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: "Segurança de acesso" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("heading", { name: "Auditoria e governança" }).length).toBeGreaterThan(0);
  });

  it("oferece caixas por domínio para configurar os cadastros operacionais", () => {
    render(<SettingsWorkspace />);

    expect(screen.getByRole("button", { name: /empresas/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /regionais/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cidades/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fornecedores e preços/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tipos de mídia/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /categorias financeiras/i })).toBeInTheDocument();
  });
});
