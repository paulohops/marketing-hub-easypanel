import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const trpcStub = vi.hoisted(() => {
  const mutation = () => ({ mutate: vi.fn(), isPending: false });
  const settings = new Proxy(
    {
      overview: { useQuery: () => ({ isLoading: false, data: { providers: [], regionals: [], cities: [], stores: [], commercialSupervisorStores: [], suppliers: [], partners: [], commercialSupervisors: [], serviceTypes: [], mediaTypes: [], actionTypes: [], eventTypes: [], financialCategories: [], supplierOfferings: [] } }) },
      supplierCoverage: { useQuery: () => ({ isLoading: false, data: { citiesBySupplier: [], servicesBySupplier: [], mediaBySupplier: [] } }) },
    },
    { get: (target, property) => target[property as keyof typeof target] ?? { useMutation: mutation } },
  );
  return {
    useUtils: () => ({ settings: { overview: { invalidate: vi.fn() }, supplierCoverage: { invalidate: vi.fn() } } }),
    settings,
  };
});

vi.mock("@/lib/trpc", () => ({ trpc: trpcStub }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import OperationalRegistriesPanel from "./OperationalRegistriesPanel";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/cadastros");
  vi.clearAllMocks();
});

describe("centro de cadastros operacionais", () => {
  it("organiza os domínios configuráveis em cartões de acesso às telas próprias", () => {
    render(<OperationalRegistriesPanel />);

    expect(screen.getByRole("heading", { name: "Cadastros operacionais" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /empresas/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fornecedores e preços/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tipos de ação/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it.each([
    ["Empresas", "/cadastros/empresas"],
    ["Regionais", "/cadastros/regionais"],
    ["Cidades", "/cadastros/cidades"],
    ["Fornecedores e preços", "/cadastros/fornecedores"],
    ["Parceiros", "/cadastros/parceiros"],
    ["Supervisores comerciais", "/cadastros/supervisores"],
    ["Tipos de ação", "/cadastros/tipos-de-acao"],
    ["Tipos de evento", "/cadastros/tipos-de-evento"],
    ["Tipos de mídia", "/cadastros/tipos-de-midia"],
    ["Serviços", "/cadastros/servicos"],
    ["Categorias financeiras", "/cadastros/categorias-financeiras"],
    ["Pontos de ação", "/pontos-de-acao"],
  ])("direciona %s para %s", (cardTitle, expectedPath) => {
    window.history.replaceState({}, "", "/cadastros");
    render(<OperationalRegistriesPanel />);

    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${cardTitle}`) }));

    expect(window.location.pathname).toBe(expectedPath);
  });
});
