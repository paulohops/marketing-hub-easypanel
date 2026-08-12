import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const mutations = vi.hoisted(() => ({ createProvider: vi.fn(), createFinancialCategory: vi.fn(), setRegistryActive: vi.fn() }));
const trpcStub = vi.hoisted(() => {
  const mutation = () => ({ mutate: vi.fn(), isPending: false });
  const overviewData = { providers: [{ id: 1, name: "Cluster MG", active: true }], regionals: [{ id: 2, name: "Central", code: "MG-C", active: true }], cities: [{ id: 3, name: "Belo Horizonte", state: "MG", active: true }], suppliers: [{ id: 4, displayName: "Fornecedor BH", active: true, email: "contato@fornecedor.com", phone: null }], partners: [], serviceTypes: [{ id: 5, name: "Locução", active: true }], mediaTypes: [{ id: 6, name: "Rádio", active: true }], actionTypes: [], eventTypes: [], financialCategories: [{ id: 7, name: "Trade e Eventos", description: "Verba principal", active: true }], supplierOfferings: [] };
  const coverageData = { citiesBySupplier: [], servicesBySupplier: [], mediaBySupplier: [] };
  return {
    useUtils: () => ({ settings: { overview: { invalidate: vi.fn() }, supplierCoverage: { invalidate: vi.fn() } } }),
    settings: {
      overview: { useQuery: () => ({ isLoading: false, data: overviewData }) },
      supplierCoverage: { useQuery: () => ({ isLoading: false, data: coverageData }) },
      createProvider: { useMutation: () => ({ mutate: mutations.createProvider, isPending: false }) }, createRegional: { useMutation: mutation }, createCity: { useMutation: mutation }, createPartner: { useMutation: mutation }, createSupplier: { useMutation: mutation }, createType: { useMutation: mutation }, createFinancialCategory: { useMutation: () => ({ mutate: mutations.createFinancialCategory, isPending: false }) }, createSupplierOffering: { useMutation: mutation }, setSupplierCoverage: { useMutation: mutation }, setRegistryActive: { useMutation: () => ({ mutate: mutations.setRegistryActive, isPending: false }) },
    },
  };
});

vi.mock("@/lib/trpc", () => ({ trpc: trpcStub }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import OperationalRegistriesPanel from "./OperationalRegistriesPanel";

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("centro de cadastros operacionais", () => {
  it("organiza os domínios configuráveis em caixas e abre o cadastro de fornecedores", () => {
    render(<OperationalRegistriesPanel />);

    expect(screen.getByRole("heading", { name: "Cadastros operacionais" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /empresas/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tipos de ação/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fornecedores e preços/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /fornecedores e preços/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("CNPJ")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Fornecedor"), { target: { value: "4" } });
    expect(screen.getByText("Cidades atendidas")).toBeInTheDocument();
    expect(screen.getByLabelText("Preço unitário (R$)")).toBeInTheDocument();
  });

  it("permite cadastrar empresas e categorias financeiras e alterar o status dos registros", () => {
    render(<OperationalRegistriesPanel />);

    fireEvent.click(screen.getByRole("button", { name: /empresas/i }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Sempre Internet" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar" }));
    expect(mutations.createProvider).toHaveBeenCalledWith({ name: "Sempre Internet" });
    fireEvent.click(screen.getByRole("button", { name: "Inativar" }));
    expect(mutations.setRegistryActive).toHaveBeenLastCalledWith({ kind: "provider", id: 1, active: false });

    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    fireEvent.click(screen.getByRole("button", { name: /categorias financeiras/i }));
    fireEvent.change(screen.getByLabelText("Nome"), { target: { value: "Mídia de rua" } });
    fireEvent.click(screen.getByRole("button", { name: "Cadastrar" }));
    expect(mutations.createFinancialCategory).toHaveBeenCalledWith({ name: "Mídia de rua" });
    fireEvent.click(screen.getByRole("button", { name: "Inativar" }));
    expect(mutations.setRegistryActive).toHaveBeenLastCalledWith({ kind: "financial_category", id: 7, active: false });
  });
});
